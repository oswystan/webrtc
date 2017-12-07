/*
 *********************************************************************************
 *                     Copyright (C) 2017 wystan
 *
 *       filename: run.js
 *    description:
 *        created: 2017-12-05 16:07:06
 *         author: wystan
 *
 *********************************************************************************
 */

function errHandler(err) {
    console.log(err);
}

function checkApi() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.enumerateDevices) {
        return 0;
    } else {
        console.log("ERROR: no enough api supported");
        return -1;
    }
}

function getDevices(devType, cb) {
    if (checkApi() != 0) {
        cb([]);
    } else {
        navigator.mediaDevices.enumerateDevices()
            .then(function(devs){
                if (devType === "*") {
                    cb(devs);
                } else {
                    let filterDevs = [];
                    devs.forEach(function(dev){
                        if (dev.kind === devType) {
                            filterDevs.push(dev);
                        }
                    });
                    cb(filterDevs);
                }
            }).catch(errHandler);
    }
}

// getDevices("audioinput", function(devs){
//     console.log(devs);
// });

function playAV(elemId) {
    if (checkApi() != 0) {
        return;
    }

    var contraints = {
        audio: true,
        video: { width: 640, height: 480 }
    };
    navigator.mediaDevices.getUserMedia(contraints)
        .then(function(stream){
            $(elemId).prop("srcObject", stream);
        }).catch(errHandler);
}
// playAV('#local_video');

function createStream(contraints, cb) {
    if (checkApi() != 0) {
        cb(null);
    } else {
        navigator.mediaDevices.getUserMedia(contraints)
        .then(function(stream){
            cb(stream);
        }).catch(function(err){
            errHandler(err);
            cb(null);
        });
    }

}

function createSendOnlyOffer() {
    //stun servers get from 
    var opts = {
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
    var rtc = new RTCPeerConnection(opts);
    rtc.onicegatheringstatechange = function(){
        console.log(rtc.iceGatheringState);
    };
    console.log(rtc);
    rtc.onicecandidate = function(evt) {
        if (evt.candidate) {
            console.log(evt.candidate.toJSON());
        }else{
            console.log("done...");
        }
    };
    var contraints = {
        audio: true,
        video: { width: 640, height: 480 }
    };

    createStream(contraints, function(stream){
        if (stream == null) {
            return;
        }
        rtc.addStream(stream);
        rtc.createOffer({offerToReceiveVideo: false, offerToReceiveAudio: false})
            .then(function(sdp){
                console.log(sdp.toJSON());
                rtc.setLocalDescription(sdp);
            }).catch(errHandler);
    });
}
createSendOnlyOffer();


/************************************* END **************************************/

