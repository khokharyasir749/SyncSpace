import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, User, ArrowRight, UserPlus, X, Search, Users, Minimize2 } from 'lucide-react';
import Avatar from '../common/Avatar';
import FloatingHuddleBar from './FloatingHuddleBar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoMeetingModal = ({
  isOpen,
  isMinimized = false,
  onToggleMinimize,
  isAudioOnly = false,
  isInitiator = false,
  callerName = 'You',
  callerAvatar = '',
  peerName = 'Teammate',
  peerAvatar = '',
  socket,
  targetUserId,
  targetRoomId,
  workspaceId,
  channelId,
  channelName,
  incomingSignalData,
  onlineUserIds = new Set(),
  teammates = [],
  isChannel: isChannelProp,
  isRecipientOnline: isRecipientOnlineProp,
  onEndCall,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(isAudioOnly);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Invite Teammates Drawer State
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState(new Set());

  // Determine Channel vs Direct Message Call
  const isChannelCall =
    isChannelProp !== undefined
      ? Boolean(isChannelProp)
      : Boolean(targetRoomId?.startsWith('channel_') || peerName?.startsWith('#') || !targetUserId);

  const cleanChannelName = peerName.startsWith('#') ? peerName : `#${peerName}`;

  // Check if any other workspace members are currently online
  const hasOnlineTeammates = useMemo(() => {
    if (!Array.isArray(teammates)) return false;
    return teammates.some((t) => t?._id && onlineUserIds.has(t._id.toString()));
  }, [teammates, onlineUserIds]);

  // Derived presence status for recipient (DM call)
  const opponentId = targetUserId ? targetUserId.toString() : null;
  const isRecipientOnline =
    isRecipientOnlineProp !== undefined
      ? Boolean(isRecipientOnlineProp)
      : opponentId
      ? onlineUserIds.has(opponentId)
      : true;

  // Filter available teammates for inviting (exclude targetUserId & current room participants)
  const filteredTeammates = useMemo(() => {
    if (!Array.isArray(teammates)) return [];
    return teammates.filter((t) => {
      if (!t?._id) return false;
      const tId = t._id.toString();
      if (opponentId && tId === opponentId) return false;
      if (inviteSearchQuery.trim()) {
        return t.name.toLowerCase().includes(inviteSearchQuery.toLowerCase());
      }
      return true;
    });
  }, [teammates, opponentId, inviteSearchQuery]);

  // Live Timer hook
  useEffect(() => {
    let interval = null;
    if (callConnected) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callConnected]);

  // Offline Auto-Timeout (18 seconds fallback if DM recipient is offline)
  useEffect(() => {
    if (!isOpen || callConnected || isChannelCall) return;

    let offlineTimeout = null;
    if (isInitiator && !isRecipientOnline) {
      offlineTimeout = setTimeout(() => {
        // Show unavailable notification toast
        const toast = document.createElement('div');
        toast.className =
          'fixed top-5 right-5 z-[100] bg-slate-900 text-slate-100 border border-slate-700/80 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm animate-in slide-in-from-top duration-300 font-medium';
        toast.innerHTML = `
          <div class="w-2 h-2 rounded-full bg-amber-400"></div>
          <span><strong>${peerName}</strong> is currently unavailable</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);

        handleHangup();
      }, 18000);
    }

    return () => {
      if (offlineTimeout) clearTimeout(offlineTimeout);
    };
  }, [isOpen, callConnected, isInitiator, isRecipientOnline, isChannelCall, peerName]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;

    const initializeCall = async () => {
      try {
        // 1. Get user media
        const constraints = {
          audio: true,
          video: !isAudioOnly,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isSubscribed) return;

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Create RTCPeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Handle remote stream
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
            setCallConnected(true);
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('ice_candidate', {
              targetUserId,
              targetRoomId,
              candidate: event.candidate,
            });
          }
        };

        // 3. Signaling logic
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call_user', {
            targetUserId,
            targetRoomId,
            signalData: offer,
            isAudioOnly,
            workspaceId,
            channelId: channelId || (targetRoomId && typeof targetRoomId === 'string' && targetRoomId.startsWith('channel_') ? targetRoomId.replace(/^channel_/, '') : null),
            channelName: channelName || (peerName?.startsWith('#') ? peerName.slice(1) : peerName),
            meetingId: targetRoomId,
            callType: isAudioOnly ? 'audio' : 'video',
          });
        } else if (incomingSignalData) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingSignalData));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('call_accepted', {
            toUserId: targetUserId,
            targetRoomId,
            signalData: answer,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Initialization error:', err);
      }
    };

    initializeCall();

    // Socket Event Listeners for Call Progress
    const handleCallAccepted = async (data) => {
      if (peerConnectionRef.current && data?.signalData) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.signalData)
        );
        setCallConnected(true);
      }
    };

    const handleIceCandidate = async (data) => {
      if (peerConnectionRef.current && data?.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[WebRTC] Error adding ICE candidate:', e);
        }
      }
    };

    const handleCallEndedSignal = () => {
      const finalDuration = timerSeconds;
      const finalStatus = callConnected ? 'completed' : 'missed';
      cleanupMedia();
      if (onEndCall) onEndCall({ duration: finalDuration, status: finalStatus, isAudioOnly, type: isAudioOnly ? 'audio' : 'video' });
    };

    if (socket) {
      socket.on('call_accepted', handleCallAccepted);
      socket.on('ice_candidate', handleIceCandidate);
      socket.on('call_ended', handleCallEndedSignal);
    }

    return () => {
      isSubscribed = false;
      cleanupMedia();
      if (socket) {
        socket.off('call_accepted', handleCallAccepted);
        socket.off('ice_candidate', handleIceCandidate);
        socket.off('call_ended', handleCallEndedSignal);
      }
    };
  }, [isOpen]);

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setCallConnected(false);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');

        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');

        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }

        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error('[WebRTC] Screen share error:', err);
    }
  };

  const handleInviteTeammate = (member) => {
    if (!member?._id || !socket) return;
    const tId = member._id.toString();

    const meetingRoomId = targetRoomId || `meeting_${targetUserId || 'room'}_${Date.now()}`;

    socket.emit('meeting_invite_sent', {
      meetingRoomId,
      targetUserId: tId,
      callerName,
      isAudioOnly,
    });

    setInvitedUserIds((prev) => new Set(prev).add(tId));

    // Show toast confirmation
    const toast = document.createElement('div');
    toast.className =
      'fixed top-5 right-5 z-[100] bg-indigo-950 text-indigo-100 border border-indigo-500/40 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-top duration-200 font-medium';
    toast.innerHTML = `<span>Invitation sent to <strong>${member.name}</strong></span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleHangup = () => {
    if (socket) {
      socket.emit('call_ended', {
        targetUserId,
        targetRoomId,
        workspaceId,
        channelId: channelId || (targetRoomId && typeof targetRoomId === 'string' && targetRoomId.startsWith('channel_') ? targetRoomId.replace(/^channel_/, '') : null),
      });
    }
    const finalDuration = timerSeconds;
    const finalStatus = callConnected ? 'completed' : 'missed';
    cleanupMedia();
    if (onEndCall) onEndCall({ duration: finalDuration, status: finalStatus, isAudioOnly, type: isAudioOnly ? 'audio' : 'video' });
  };

  if (!isOpen) return null;

  // Participant names / avatars order
  const p1Name = isInitiator ? callerName : peerName;
  const p1Avatar = isInitiator ? callerAvatar : peerAvatar;
  const p2Name = isInitiator ? peerName : callerName;
  const p2Avatar = isInitiator ? peerAvatar : callerAvatar;

  // Multi-participant grid layout determination
  const totalParticipantCount = 2 + invitedUserIds.size;
  const gridColsClass =
    totalParticipantCount <= 1
      ? 'grid-cols-1'
      : totalParticipantCount === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      <div
        className={
          isMinimized
            ? 'hidden'
            : 'fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200'
        }
      >
        {/* Top Bar with Dual Participants and Live Timer / Status Badge */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <Avatar src={p1Avatar} name={p1Name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl" />
              <span className="text-slate-200 font-bold text-xs sm:text-sm">{p1Name}</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

            <div className="flex items-center gap-2">
              <Avatar src={p2Avatar} name={p2Name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl" />
              <span className="text-slate-200 font-bold text-xs sm:text-sm">{p2Name}</span>
            </div>

            {invitedUserIds.size > 0 && (
              <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>+{invitedUserIds.size} Invited</span>
              </span>
            )}
          </div>

          {/* Live Call Duration Timer vs Channel / DM Status Badge & Minimize Button */}
          <div className="flex items-center gap-2">
            {callConnected ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatTimer(timerSeconds)}</span>
              </div>
            ) : isChannelCall ? (
              hasOnlineTeammates ? (
                <div className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active Meeting</span>
                </div>
              ) : (
                <div className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span>Meeting Room</span>
                </div>
              )
            ) : !isRecipientOnline ? (
              <div className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Calling...</span>
              </div>
            ) : (
              <div className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Ringing...</span>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleMinimize}
              className="p-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Minimize Call"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Video View Area */}
        <div className="relative flex-1 my-4 bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-2xl">
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${isAudioOnly || cameraOff ? 'hidden' : 'block'}`}
          />

          {/* Fallback Audio Call / Waiting Center View (Centered & Clear of Floating PIP) */}
          {(isAudioOnly || !callConnected) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
              <div className="pointer-events-auto text-center mx-auto max-w-sm flex flex-col items-center gap-4 select-none px-4">
                <Avatar
                  src={peerAvatar}
                  name={peerName}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-slate-800 shadow-2xl"
                  textClassName="text-3xl sm:text-4xl font-bold"
                />
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-100">{peerName}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">
                    {callConnected
                      ? isAudioOnly
                        ? 'In Audio Call'
                        : 'Video Connected'
                      : isChannelCall
                      ? `Channel Meeting • ${cleanChannelName}`
                      : isRecipientOnline
                      ? 'Ringing...'
                      : 'Calling...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Floating Self Camera PIP Box */}
          {!isAudioOnly && (
            <div className="absolute bottom-5 right-5 w-32 h-24 sm:w-48 sm:h-36 bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl z-10 transition-all hover:scale-105">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraOff ? 'hidden' : 'block'}`}
              />
              {cameraOff && (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                  <User className="w-8 h-8" />
                </div>
              )}
            </div>
          )}

          {/* Invite Teammates Drawer / Slide-Over Popover */}
          {isInviteDrawerOpen && (
            <div className="absolute top-4 right-4 bottom-4 w-80 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col z-20 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs text-slate-200">Invite to Meeting</span>
                </div>
                <button
                  onClick={() => setIsInviteDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="my-3 relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inviteSearchQuery}
                  onChange={(e) => setInviteSearchQuery(e.target.value)}
                  placeholder="Search teammates..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Teammates List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredTeammates.length > 0 ? (
                  filteredTeammates.map((member) => {
                    const isOnline = onlineUserIds.has(member._id.toString());
                    const isAlreadyInvited = invitedUserIds.has(member._id.toString());

                    return (
                      <div
                        key={member._id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar src={member.avatar} name={member.name} className="w-7 h-7 rounded-lg" />
                            {isOnline && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 border border-slate-950 absolute -bottom-0.5 -right-0.5" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px]">
                            {member.name}
                          </span>
                        </div>

                        {isAlreadyInvited ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                            Invited
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInviteTeammate(member)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Add to Call
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No teammates found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 z-10 bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-3xl max-w-xl mx-auto w-full shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              micMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={micMuted ? 'Unmute' : 'Mute'}
          >
            {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              cameraOff
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {!isAudioOnly && (
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
          )}

          {/* Add Member / Invite to Meeting Button */}
          <button
            type="button"
            onClick={() => setIsInviteDrawerOpen((prev) => !prev)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isInviteDrawerOpen ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title="Invite to Meeting"
          >
            <UserPlus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleHangup}
            className="w-14 h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform active:scale-95 cursor-pointer ml-2"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isMinimized && (
        <FloatingHuddleBar
          peerName={peerName}
          peerAvatar={peerAvatar}
          callConnected={callConnected}
          timerSeconds={timerSeconds}
          isVideoCall={!isAudioOnly}
          remoteStream={remoteStream}
          micMuted={micMuted}
          cameraOff={cameraOff}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onMaximize={onToggleMinimize}
          onHangup={handleHangup}
        />
      )}
    </>
  );
};

export default VideoMeetingModal;
