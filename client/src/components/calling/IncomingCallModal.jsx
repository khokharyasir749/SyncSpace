import React from 'react';
import { Phone, PhoneOff, Video, Mic, Users } from 'lucide-react';
import Avatar from '../common/Avatar';

const IncomingCallModal = ({ callData, onAccept, onDecline }) => {
  if (!callData) return null;

  const { fromUserName, fromUserAvatar, isAudioOnly, isChannelCall, channelName, targetRoomId } = callData;

  const isChannel = Boolean(
    isChannelCall ||
    channelName ||
    (targetRoomId && typeof targetRoomId === 'string' && targetRoomId.startsWith('channel_'))
  );

  const callTypeLabel = isAudioOnly ? 'Audio' : 'Video';
  const cleanChannelName = channelName ? (channelName.startsWith('#') ? channelName : `#${channelName}`) : 'Channel';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-200">
        {/* Pulsating Ring Avatar */}
        <div className="relative flex items-center justify-center my-2">
          <span className="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-emerald-500/30 opacity-75" />
          <Avatar
            src={fromUserAvatar}
            name={fromUserName}
            className="w-20 h-20 rounded-full border-2 border-emerald-500 shadow-xl shadow-emerald-500/20 relative"
            textClassName="text-xl font-bold"
          />
        </div>

        {/* Text Details */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-slate-100">{fromUserName}</h3>
          {isChannel ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{cleanChannelName} Meeting</span>
              </span>
              <p className="text-xs text-slate-400 font-medium">
                Started an incoming {callTypeLabel.toLowerCase()} meeting
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 mt-1">
              {isAudioOnly ? <Mic className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span>Incoming {callTypeLabel} Call...</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 w-full mt-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-rose-400 group-hover:text-rose-300">Decline</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 animate-bounce">
              {isAudioOnly ? <Phone className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 group-hover:text-emerald-300">
              {isChannel ? 'Join Call' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
