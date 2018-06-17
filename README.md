# webrtc
some webrtc sample code


## check list for support chrome58
>
- use adapter-6.2.1.js
- RTCPeerConnection.onicecandidate to determine ice state change.
- set iceServers parameter when create a new RTCPeerConnection.
- ignore payload description string case(because sometimes it use uppercase, but sometimes it use lowercase);

