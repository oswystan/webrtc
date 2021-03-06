/*
 *********************************************************************************
 *                     Copyright (C) 2017 wystan
 *
 *       filename: room.js
 *    description:
 *        created: 2017-12-07 15:03:02
 *         author: wystan
 *
 *********************************************************************************
 */
var log = console.log;
var md = navigator.mediaDevices;
var lv = $("#local_video");
var rv = $("#remote_video");
var ls = $("#local_status");
var rs = $("#remote_status");
var btn_pub = $("#btn_pub");
var btn_sub = $("#btn_sub");
var btn_stop = $("#btn_stop");
var room = $("#room_id");
// var rtc_cfg = {iceServers: [{ urls:[ "stun:stun.ekiga.net" ] }]};
var rtc_cfg = {iceServers: []};
var pc = null;
var ws = new WebSocket('ws://' + window.location.host + '/');
var candi = [];
var localstream = null;
var remotestream = null;
var role = "puber";


class SdpMedia {
    constructor(t, start, end) {
        this.type = t;
        this.start = start;
        this.end = end;
    };
};
class SdpUtil {
    constructor() {
        this.sdplines = [];
        this.medias = [];
    };

    parse(sdp) {
        let lines = sdp.split('\n');
        let media = null;
        let j = 0;
        for(let i=0; i<lines.length; i++, j++) {
            let line = lines[i].trim();
            if(line.length === 0) continue;

            this.sdplines.push(line);
            let matcher = line.match(/m=(\S+)/);
            if(matcher) {
                if(media) {
                    media.end = j-1;
                    this.medias.push(media);
                }
                media = new SdpMedia(matcher[1], j, j);
            }
        }
        if(media) {
            media.end = this.sdplines.length-1;
            this.medias.push(media);
        }
    };

    setBitRate(type, br) {
        let i = 0;
        let j = 0;
        i = this.medias.findIndex(m=>m.type === type);
        if(i < 0) {
            loge("NO media type:", type);
            return;
        }
        let media = this.medias[i];
        let attr = "b=AS:" + br;
        for(j=media.start; j<=media.end; j++) {
            if(this.sdplines[j].indexOf("b=AS:") === 0) {
                this.sdplines[j] = attr;
                break;
            }
        }
        if(j>media.end) {
            this.sdplines.splice(j, 0, attr);
            media.end++;
            i++;
            for(; i<this.medias.length; i++) {
                this.medias[i].start++;
                this.medias[i].end++;
            }
        }
    };
    setAudioChannel(channel) {
        let idx = this.medias.findIndex(m=> m.type === "audio");
        if(idx < 0) return;
        let media = this.medias[idx];
        let i = 0;
        let attr = "a=fmtp"
        for(i=media.start; i<=media.end; i++) {
            if(this.sdplines[i].indexOf("opus") > 0) {
                break;
            }
        }
        if(i<=media.end) {
            //1. get payload type
            let result = this.sdplines[i].match(/a=rtpmap:(\d+)\sopus\//);
            if (result.length < 2) return;

            //2. insert new attribute into sdp
            let stereo = 1;
            if (channel === 1) {
                stereo = 0;
            }
            let attr = "a=fmtp:" + result[1] + " stereo=" + stereo + ";sprop-stereo=" + stereo;
            this.sdplines.splice(i, 0, attr);

            //3. change media start and end index
            media.end++;
            for(idx=idx+1; idx<this.medias.length; idx++) {
                this.medias[idx].start++;
                this.medias[idx].end++;
            }
        }
    }
    setClipRect(width, height) {
        let idx = this.medias.findIndex(m=> m.type === "video");
        if(idx < 0) return;
        let media = this.medias[idx];
        let i = 0;
        let attr = "a=cliprect:0,0," + width + "," + height;
        for(i=media.start; i<=media.end; i++) {
            if(this.sdplines[i].indexOf("a=cliprect:") === 0) {
                this.sdplines[i] = attr;
                break;
            }
        }
        if(i>media.end) {
            this.sdplines.splice(i, 0, attr);
            media.end++;
            for(idx=idx+1; idx<this.medias.length; idx++) {
                this.medias[idx].start++;
                this.medias[idx].end++;
            }
        }
    };

    removeAttr(prefix) {
        for (let i=0; i<this.sdplines.length; i++) {
            if (this.sdplines[i].indexOf(prefix) == 0) {
                this.sdplines.splice(i, 1);
                break;
            }
        }
    }
    isacOnly() {
        let idx = this.medias.findIndex(m=> m.type === "audio");
        if(idx < 0) return;
        let media = this.medias[idx];
        this.sdplines[media.start] = "m=audio 9 UDP/TLS/RTP/SAVPF 103";
        this.removeAttr("a=rtpmap:111");
        this.removeAttr("a=rtcp-fb:111");
        this.removeAttr("a=fmtp:111");
        this.removeAttr("a=rtpmap:104");
        this.removeAttr("a=rtpmap:9");
        this.removeAttr("a=rtpmap:0");
        this.removeAttr("a=rtpmap:8");
    }
    serialize() {
        return this.sdplines.reduce((a,b)=>a+"\r\n"+b) + "\r\n";
    };
    dump() {
        for(let i=0; i<this.medias.length; i++) {
            logd(this.medias[i]);
        }
        logd("TOTAL LINES:", this.sdplines.length);
        logd("-----------------------------");
        this.sdplines.forEach(l=>logd(l));
        logd("-----------------------------");
    };
};



btn_pub.click(do_pub);
btn_sub.click(do_sub);
btn_stop.click(do_stop);

function btn_disable(a, b, c) {
    btn_pub.prop("disabled", a);
    btn_sub.prop("disabled", b);
    btn_stop.prop("disabled", c);
}
function err_handler(e) {
    loge(e);
}
function close_stream(s) {
    s.getTracks().forEach(function(t) {
        t.stop();
    });
}
function set_stream(l, r) {
    lv.prop("srcObject", l);
    rv.prop("srcObject", r);
}
function sendcmd_pub(sdp) {
    var msg = { "command": "pub", "sdp": sdp };
    ws.send(JSON.stringify(msg));
}
function sendcmd_sub() {
    var msg = { "command": "sub" };
    ws.send(JSON.stringify(msg));
}
function sendcmd_play(sdp) {
    var msg = { "command": "play", "sdp": sdp };
    ws.send(JSON.stringify(msg));
}
function set_pc_notify(pc) {
    pc.onconnectionstatechange = function(e) {
        logi("notify=> onconnectionstatechange: " + pc.connectionState);
    };
    pc.oniceconnectionstatechange = function(e){
        logi("notify=> oniceconnectionstatechange: " + pc.iceConnectionState);
        rs.html(pc.iceConnectionState);
    };
    pc.onicegatheringstatechange = function(e){
        logi("notify=> onicegatheringstatechange: " + pc.iceGatheringState);
    };
    pc.onidentityresult = function(e) {
        logi("notify=> onidentityresult: " + e.assertion);
    };
    pc.onidpassertionerror = function(e) {
        logi("notify=> onidpassertionerror");
        loge(e);
    };
    pc.onidpvalidationerror = function(e) {
        logi("notify=> onidpvalidationerror");
        loge(e);
    };
    pc.onnegotiationneeded = function(e) {
        logi("notify=> onnegotiationneeded");
    };
    pc.onpeeridentity = function(e) {
        logi("notify=> onpeeridentity");
        logi(e);
    };
    pc.onremovestream = function(e) {
        logi("notify=> onremovestream: " + e.stream.id);
    };
    pc.onsignalingstatechange = function(e) {
        logi("notify=> onsignalingstatechange: " + pc.signalingState);
        ls.html(pc.signalingState);
    };
}

function do_pub() {
    ls.html("");
    rs.html("");
    logv("");
    role = "puber";
    btn_disable(true, false, false);
    candi = [];
    logi("flow=> new RTCPeerConnection");
    pc = new RTCPeerConnection(rtc_cfg);
    set_pc_notify(pc);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) return;
        if (role === "puber") {
            logi("flow=> ice gathering finished, then send pub command(with offer sdp) to signal server.");
            sendcmd_pub(pc.localDescription);
        }
    };
    pc.ontrack = function(e) {
        logi("notify=> on track");
    };
    var contraints = { audio: true, video: { width: 640, height: 480 }};

    var create_offer = function(stream) {
        localstream = stream;
        lv.prop("srcObject", stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        logi("flow=> create offer");
        pc.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp) {
                logi("flow=> offer created, then set local description");
                logd(sdp);
                pc.setLocalDescription(sdp);
            }).catch(err_handler);
    };

    logi("flow=> get user media");
    md.getUserMedia(contraints).then(create_offer).catch(err_handler);
}

function do_p2p() {
    let pc1 = new RTCPeerConnection(rtc_cfg);
    let pc2 = new RTCPeerConnection(rtc_cfg);
    let pc3 = new RTCPeerConnection(rtc_cfg);
    let pc4 = new RTCPeerConnection(rtc_cfg);

    let pc2_stream = null;

    pc4.ontrack = function(e) {
        if (e.track.kind !=="video") return;
        rv.prop("srcObject", e.streams[0]);
    };
    pc4.onicegatheringstatechange = function() {
        if (pc4.iceGatheringState === "complete") {
            pc3.setRemoteDescription(pc4.localDescription);
        }
    };
    var set_offer_pc4 = function(sdp) {
        pc4.setRemoteDescription(sdp);
        pc4.createAnswer().then(function(answer){
            pc4.setLocalDescription(answer);
        }).catch(err_handler);
    }

    pc3.onicegatheringstatechange = function() {
        if (pc3.iceGatheringState === "complete") {
            set_offer_pc4(pc3.localDescription);
        }
    };
    var create_offer_pc3 = function() {
        let stream = pc2_stream;
        stream.getTracks().forEach(track => pc3.addTrack(track, stream));
        pc3.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp) {
                logi("pc3.setLocalDescription:", sdp);
                let sdputil = new SdpUtil();
                sdputil.parse(sdp.sdp);
                sdputil.isacOnly();
                sdp.sdp = sdputil.serialize();
                logi("create offer 2=>", sdp.sdp);
                pc3.setLocalDescription(sdp);
            }).catch(err_handler);
    };

    pc2.ontrack = function(e) {
        if (e.track.kind !== "video") return;
        logi("pc2.ontrack");
        pc2_stream = e.streams[0];
    };
    pc2.onicegatheringstatechange = function() {
        if (pc2.iceGatheringState === "complete") {
            logi("pc2.onicegatheringstatechange");
            pc1.setRemoteDescription(pc2.localDescription);
            create_offer_pc3();
        }
    };
    var set_offer = function(sdp) {
        logi("set_offer");
        pc2.setRemoteDescription(sdp);
        pc2.createAnswer().then(function(sdp){
            pc2.setLocalDescription(sdp);
        }).catch(err_handler);
    }

    pc1.onicegatheringstatechange = function() {
        if (pc1.iceGatheringState === "complete") {
            set_offer(pc1.localDescription);
        }
    };
    var create_offer = function(stream) {
        lv.prop("srcObject", stream);
        stream.getTracks().forEach(track => pc1.addTrack(track, stream));
        pc1.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp) {
                let sdputil = new SdpUtil();
                sdputil.parse(sdp.sdp);
                sdputil.isacOnly();
                sdp.sdp = sdputil.serialize();
                logi("create offer 1=>", sdp.sdp);
                pc1.setLocalDescription(sdp);
            }).catch(err_handler);
    };

    var contraints = { audio: true, video: { width: 640, height: 480 }};
    md.getUserMedia(contraints).then(create_offer).catch(err_handler);
}

function do_sub() {
    role = "suber";
    btn_disable(true, true, false);
    ls.html("");
    rs.html("");
    logv("");
    logi("flow=> new RTCPeerConnection");
    pc = new RTCPeerConnection(rtc_cfg);
    set_pc_notify(pc);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) return;
        if(role === "suber") {
            logi("flow=> ice gathering finished, then send play command(with answer sdp) to signal server.");
            sendcmd_play(pc.localDescription);
        }
    };
    logi("flow=> send subscribe command to server");
    sendcmd_sub();
}

function do_stop() {
    btn_disable(false, false, false);
    set_stream(null, null);
    if (pc && pc.signalingState != "closed") {
        logi("flow=> close RTCPeerConnection");
        pc.close();
    }
    pc = null;
    logi("flow=> close local or remote stream if needed");
    if (localstream) close_stream(localstream);
    if (remotestream) close_stream(remotestream);
    localstream = null;
    remotestream = null;
}

ws.onopen = function(e) {
    logi("flow=> ws open");
}
ws.onclose = function(e) {
    logw("flow=> ws close");
}
ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === "offer") {
        logi("flow=> get offer from signal server, set remote description");
        pc.setRemoteDescription(msg).then(function(){
        }).catch(err_handler);

        logi("flow=> create answer");
        pc.createAnswer().then(function(sdp) {
            logi("flow=> answer created, then set local description");
            pc.setLocalDescription(sdp);
        }).catch(err_handler);

        pc.ontrack = function(e) {
            logi("notify=> new track: " + e.track.kind);
            set_stream(null, e.streams[0]);
            remotestream = e.streams[0];
        };
    } else if (msg.type === "answer") {
        logi("flow=> get answer from signal server, then set remote description");
        pc.setRemoteDescription(msg);
    }
}

/************************************* END **************************************/
