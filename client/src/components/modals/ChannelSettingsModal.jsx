import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Hash, Lock, Users, Plus, Trash2, Check, Loader2, Camera, Shield } from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';

const ChannelSettingsModal = ({ isOpen, channel, workspaceMembers = [], onClose, onChannelUpdated }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'members'

  const myId = (user?._id || user?.id)?.toString();

  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      setAvatar(channel.avatar || '');
      setMembers(Array.isArray(channel.members) ? channel.members.map((m) => (typeof m === 'object' ? m._id : m)) : []);
      setAdmins(Array.isArray(channel.admins) ? channel.admins.map((a) => (typeof a === 'object' ? a._id : a)) : []);
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel) return null;

  const channelOwnerId = (
    channel?.creator?._id ||
    channel?.creator ||
    channel?.members?.[0]?._id ||
    channel?.members?.[0]
  )?.toString();

  const isUserAdmin =
    (admins || []).some((a) => a.toString() === myId) ||
    Boolean(channelOwnerId && channelOwnerId === myId);

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.fileUrl) {
        setAvatar(res.data.fileUrl);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload channel photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await api.put(`/channels/${channel._id}`, {
        name: name.trim(),
        description: description.trim(),
        avatar,
      });

      if (res.data?.success) {
        setSuccess(true);
        if (onChannelUpdated) onChannelUpdated(res.data.channel);
        if (socket) socket.emit('update_channel', { channel: res.data.channel });
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update channel details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMember = async (memberId) => {
    setLoading(true);
    setError('');

    const isMember = members.includes(memberId);
    const updatedMembers = isMember
      ? members.filter((id) => id !== memberId)
      : [...members, memberId];

    try {
      const res = await api.put(`/channels/${channel._id}/members`, {
        members: updatedMembers,
      });

      if (res.data?.success) {
        setMembers(updatedMembers);
        if (onChannelUpdated) onChannelUpdated(res.data.channel);
        if (socket) socket.emit('update_channel', { channel: res.data.channel });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update channel members');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminRole = async (targetUserId, makeAdmin) => {
    setLoading(true);
    setError('');

    try {
      const res = await api.put(`/channels/${channel._id}/roles`, {
        targetUserId,
        makeAdmin,
      });

      if (res.data?.success) {
        const updatedAdmins = Array.isArray(res.data.channel?.admins)
          ? res.data.channel.admins.map((a) => (typeof a === 'object' ? a._id : a))
          : [];
        setAdmins(updatedAdmins);
        if (onChannelUpdated) onChannelUpdated(res.data.channel);
        if (socket) socket.emit('update_channel', { channel: res.data.channel });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-base text-slate-100">Channel Settings</h3>
            <span className="text-xs text-slate-400 font-medium">#{channel.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            General Details
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Members ({members.length})
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Channel details updated!</span>
          </div>
        )}

        {/* Tab 1: General Details */}
        {activeTab === 'details' && (
          <form onSubmit={handleSaveDetails} className="flex flex-col gap-4">
            {/* Channel Avatar Photo Upload */}
            <div className="flex items-center gap-4">
              <div className="relative group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold text-xl">
                    #{name?.substring(0, 2)?.toUpperCase() || 'CH'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white">
                  {uploadingAvatar ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">Channel Picture</span>
                <span className="text-[11px] text-slate-400">Click to upload a custom channel icon or logo</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Channel Name</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-slate-500">#</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="general"
                  required
                  className="w-full pl-8 pr-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this channel about?"
                rows={3}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Members Management */}
        {activeTab === 'members' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              Manage workspace member access and admin permissions for #{channel.name}.
            </p>

            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
              {workspaceMembers.map((m) => {
                const u = typeof m.user === 'object' ? m.user : { _id: m.user, name: 'Member' };
                if (!u?._id) return null;
                const mId = u._id.toString();
                const isMember = members.includes(mId);

                const isCreator = Boolean(channelOwnerId && channelOwnerId === mId);
                const isAdmin = isCreator || (Array.isArray(admins) && admins.some((a) => (a?._id || a)?.toString() === mId));

                return (
                  <div
                    key={u._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        src={u.avatar}
                        name={u.name}
                        className="w-6 h-6 rounded-lg"
                      />
                      <span className="font-semibold text-slate-200 truncate">{u.name}</span>
                      {isAdmin && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                          👑 {isCreator ? 'Owner' : 'Admin'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isUserAdmin && isMember && !isCreator && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleToggleAdminRole(mId, !isAdmin)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                            isAdmin
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      )}

                      {!isCreator && isUserAdmin && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleToggleMember(mId)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            isMember
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                          }`}
                        >
                          {isMember ? (
                            <>
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
