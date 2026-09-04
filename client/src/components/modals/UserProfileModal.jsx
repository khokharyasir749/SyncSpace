import React, { useState, useEffect, useRef } from 'react';
import { X, User, Sparkles, Check, Loader2, Camera, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';

const STATUS_PRESETS = [
  'Active 🚀',
  'In a meeting 🤝',
  'Focusing 🎯',
  'Working remotely 💻',
  'On vacation 🌴',
];

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=SyncUser',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan',
];

const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUserProfile } = useAuth();
  const { socket } = useSocket();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [statusText, setStatusText] = useState('Active 🚀');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setStatusText(user.statusText || 'Active 🚀');
      setAvatar(user.avatar || '');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localPreviewUrl = URL.createObjectURL(file);
    setAvatar(localPreviewUrl);

    // Upload to server
    setUploadingAvatar(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data?.fileUrl) {
        setAvatar(res.data.fileUrl);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image file');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Display name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    const res = await updateUserProfile({
      name: name.trim(),
      statusText: statusText.trim(),
      avatar: avatar.trim(),
    });

    setLoading(false);

    if (res.success) {
      setSuccess(true);
      if (socket) {
        socket.emit('update_profile', { user: res.user });
      }
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } else {
      setError(res.message || 'Failed to update profile');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-base text-slate-100">Edit Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
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
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Avatar Preview & File Selection */}
          <div className="flex flex-col items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />

            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=SyncUser'}
                alt="Avatar Preview"
                className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-brand-500/50 shadow-glow-sm transition-opacity group-hover:opacity-80"
              />
              <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 text-[10px] font-semibold">
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 text-brand-300" />
                    <span>Upload</span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1.5 cursor-pointer mt-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo from Computer</span>
            </button>

            <div className="flex items-center gap-1.5 flex-wrap justify-center mt-1">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(preset)}
                  className={`w-7 h-7 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    avatar === preset ? 'border-brand-400 scale-110 shadow-glow-sm' : 'border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Avatar URL Input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-300">Avatar Image URL</label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Display Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-300">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              required
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Status Text & Presets */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Status Message</label>
            <input
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="What are you working on?"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-brand-500 transition-colors"
            />

            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStatusText(preset)}
                  className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                    statusText === preset
                      ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                      : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
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
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfileModal;
