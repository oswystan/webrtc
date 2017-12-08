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
var rtc_cfg = {iceServers: [{ urls:[ "stun:stun.ekiga.net" ] }]};
var pc = null;
var ws = new WebSocket('ws://' + window.location.host + '/');
var candi = [];
var localstream = null;
var remotestream = null;
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
        log("notify=> onconnectionstatechange: " + pc.connectionState);
    };
    pc.oniceconnectionstatechange = function(e){
        log("notify=> oniceconnectionstatechange: " + pc.iceConnectionState);
        rs.html(pc.iceConnectionState);
    };
    pc.onicegatheringstatechange = function(e){
        log("notify=> onicegatheringstatechange: " + pc.iceGatheringState);
    };
    pc.onidentityresult = function(e) {
        log("notify=> onidentityresult: " + e.assertion);
    };
    pc.onidpassertionerror = function(e) {
        log("notify=> onidpassertionerror");
        log(e);
    };
    pc.onidpvalidationerror = function(e) {
        log("notify=> onidpvalidationerror");
        log(e);
    };
    pc.onnegotiationneeded = function(e) {
        log("notify=> onnegotiationneeded");
    };
    pc.onpeeridentity = function(e) {
        log("notify=> onpeeridentity");
        log(e);
    };
    pc.onremovestream = function(e) {
        log("notify=> onremovestream: " + e.stream.id);
    };
    pc.onsignalingstatechange = function(e) {
        log("notify=> onsignalingstatechange: " + pc.signalingState);
        ls.html(pc.signalingState);
    };
}

function do_pub() {
    ls.html("");
    rs.html("");
    log("");
    role = "puber";
    btn_disable(true, true, false);
    candi = [];
    log("flow=> new RTCPeerConnection");
    pc = new RTCPeerConnection(rtc_cfg);
    set_pc_notify(pc);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) return;
        if (role === "puber") {
            log("flow=> ice gathering finished, then send pub command(with offer sdp) to signal server.");
            sendcmd_pub(pc.localDescription);
        }
    };
    pc.ontrack = function(e) {
        console.log("notify=> on track");
    };
    var contraints = { audio: true, video: { width: 640, height: 480 }};

    var create_offer = function(stream) {
        localstream = stream;
        lv.prop("srcObject", stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        log("flow=> create offer");
        pc.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp) {
                log("flow=> offer created, then set local description")
                pc.setLocalDescription(sdp);
            }).catch(err_handler);
    };

    log("flow=> get user media");
    md.getUserMedia(contraints).then(create_offer).catch(err_handler);
}

function do_sub() {
    role = "suber";
    btn_disable(true, true, false);
    ls.html("");
    rs.html("");
    log("");
    log("flow=> new RTCPeerConnection");
    pc = new RTCPeerConnection(rtc_cfg);
    set_pc_notify(pc);
    pc.onicecandidate = function(evt) {
        if (evt.candidate) return;
        if(role === "suber") {
            log("flow=> ice gathering finished, then send play command(with answer sdp) to signal server.");
            sendcmd_play(pc.localDescription);
        }
    };
    log("flow=> send subscribe command to server");
    sendcmd_sub();
}

function do_stop() {
    btn_disable(false, false, false);
    set_stream(null, null);
    if (pc && pc.signalingState != "closed") {
        log("flow=> close RTCPeerConnection");
        pc.close();
    }
    pc = null;
    log("flow=> close local or remote stream if needed");
    if (localstream) close_stream(localstream);
    if (remotestream) close_stream(remotestream);
    localstream = null;
    remotestream = null;
}

ws.onopen = function(e) {
    log("flow=> ws open");
}
ws.onclose = function(e) {
    log("flow=> ws close");
}
ws.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === "offer") {
        log("flow=> get offer from signal server, set remote description");
        pc.setRemoteDescription(msg).then(function(){
        }).catch(err_handler);

        log("flow=> create answer");
        pc.createAnswer().then(function(sdp) {
            log("flow=> answer created, then set local description");
            pc.setLocalDescription(sdp);
        }).catch(err_handler);

        pc.ontrack = function(e) {
            log("notify=> new track: " + e.track.kind);
            set_stream(null, e.streams[0]);
            remotestream = e.streams[0];
        };
    } else if (msg.type === "answer") {
        log("flow=> get answer from signal server, then set remote description");
        pc.setRemoteDescription(msg);
    }
}

/************************************* END **************************************/
