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
var btn_pub = $("#btn_pub");
var btn_sub = $("#btn_sub");
var btn_stop = $("#btn_stop");
var room = $("#room_id");
var rtc_cfg = {
    iceServers: [
        { urls:[                                                                                                                                                                  
            "stun:stun.ekiga.net", 
            // "stun:stun.ideasip.com", 
            // "stun:stun.schlund.de", 
            // "stun:stun.voiparound.com", 
            // "stun:stun.voipbuster.com", 
            // "stun:stun.voipstunt.com", 
            // "stun:stun.voxgratia.org", 
            // "stun:stun.xten.com"
            ] }
    ]
};
var pc = null;
var ws = new WebSocket('ws://' + window.location.host + '/');
var candi = [];
var localstream = null;
var role = "puber";

btn_pub.click(do_pub);
btn_sub.click(do_sub);
btn_stop.click(do_stop);

function btn_disable(a, b, c) {
    btn_pub.prop("disabled", a);
    btn_sub.prop("disabled", b);
    btn_stop.prop("disabled", c);
}
function err_handler(e) {
    log(e);
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
    var msg = {
        "command": "pub",
        "sdp": sdp
    }
    ws.send(JSON.stringify(msg));
}
function sendcmd_sub() {
    var msg = {
        "command": "sub",
    };
    ws.send(JSON.stringify(msg));
}
function sendcmd_play(sdp) {
    var msg = {
        "command": "play",
        "sdp": sdp
    };
    ws.send(JSON.stringify(msg));
}

function do_pub() {
    log("do pub");
    role = "puber";
    btn_disable(true, true, false);
    candi = [];
    pc = new RTCPeerConnection(rtc_cfg);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) {
            // log(evt.candidate.toJSON());
            if (evt.candidate.protocol === 'udp') {
                candi.push(evt.candidate.toJSON());
            }
        }else{
            if (role === "puber") {
                sendcmd_pub(pc.localDescription);
            } else if(role === "suber") {
                sendcmd_play(pc.localDescription);
            }
        }
    };
    var contraints = {
        audio: true,
        video: { width: 640, height: 480 }
    };

    var create_offer = function(stream) {
        localstream = stream;
        lv.prop("srcObject", stream);
        pc.addStream(stream);
        pc.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp) {
                pc.setLocalDescription(sdp);
            }).catch(err_handler);
    };

    md.getUserMedia(contraints).then(create_offer).catch(err_handler);
}

function do_sub() {
    log("do sub");
    role = "suber";
    btn_disable(true, true, false);
    pc = new RTCPeerConnection(rtc_cfg);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) {
            return;
        }

        if(role === "suber") {
            log("send play")
            log(pc.localDescription.toJSON());
            sendcmd_play(pc.localDescription);
        }
    };
    sendcmd_sub();
}

function do_stop() {
    log("do stop");
    btn_disable(false, false, false);
    set_stream(null, null);
    if (pc && pc.signalingState != "closed") {
        pc.close();
    }
    pc = null;
    if (localstream) {
        close_stream(localstream);
    }
}

ws.onopen = function(e) {
    log("ws open");
}
ws.onclose = function(e) {
    log("ws close");
}
ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === "offer") {
        pc.setRemoteDescription(msg).then(function(){
            log("set remote sdp");
        }).catch(err_handler);

        pc.createAnswer().then(function(sdp) {
            pc.setLocalDescription(sdp);
        }).catch(err_handler);

        pc.ontrack = function(e) {
            set_stream(null, e.streams[0]);
        };
    } else if (msg.type === "answer") {
        pc.setRemoteDescription(msg);
    }
}

/************************************* END **************************************/

