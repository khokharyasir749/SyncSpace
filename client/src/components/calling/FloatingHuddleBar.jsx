import React, { useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2 } from 'lucide-react';
import Avatar from '../common/Avatar';

const FloatingHuddleBar = ({
  peerName = 'Teammate',
  peerAvatar = '',
  callConnected = false,
  timerSeconds = 0,
  isVideoCall = false,
  remoteStream = null,
  micMuted = false,
  cameraOff = false,
  onToggleMic,
  onToggleCamera,
  onMaximize,
  onHangup,
}) => {
  const miniVideoRef = useRef(null);

  useEffect(() => {
    if (miniVideoRef.current && remoteStream) {
      miniVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-3 flex items-center gap-3 text-xs select-none animate-in slide-in-from-bottom-5 duration-200">
      {/* Mini Video Preview or Avatar */}
      {isVideoCall && callConnected && remoteStream ? (
        <div className="relative w-16 h-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0">
          <video
            ref={miniVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <Avatar src={peerAvatar} name={peerName} className="w-10 h-10 rounded-xl shrink-0" />
      )}

      {/* Participant Name & Live Timer */}
      <div className="flex flex-col min-w-[100px] max-w-[140px]">
        <span className="font-bold text-slate-200 truncate">{peerName}</span>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>{callConnected ? formatTimer(timerSeconds) : 'Connecting...'}</span>
        </div>
      </div>

      {/* Quick Controls */}
      <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
            micMuted
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
          }`}
          title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        {isVideoCall && (
          <button
            type="button"
            onClick={onToggleCamera}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              cameraOff
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
            }`}
            title={cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {cameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={onMaximize}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-sm transition-colors cursor-pointer"
          title="Expand Call View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onHangup}
          className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50 shadow-sm transition-colors cursor-pointer ml-1"
          title="Leave Call"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default FloatingHuddleBar;
