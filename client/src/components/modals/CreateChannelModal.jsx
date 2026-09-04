import React, { useState } from 'react';
import { X, Hash, Lock, Globe, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const sanitizeChannelName = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/^-+|-+$/g, '');
};

const CreateChannelModal = ({ isOpen, onClose, workspaceId, onChannelCreated }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const formattedName = sanitizeChannelName(name);
    if (!formattedName) {
      setError('A valid channel name is required');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/channels', {
        workspaceId,
        name: formattedName,
        type,
      });

      if (res.data?.success) {
        setName('');
        setType('public');
        onChannelCreated(res.data.channel);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-card border border-slate-700/70 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center shadow-glow-sm">
            <Hash className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Create a Channel</h2>
            <p className="text-xs text-slate-400">Channels organize team communication</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Channel Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-500 font-bold">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. announcements"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Lowercase letters, numbers, and dashes only</p>
          </div>

          {/* Visibility Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Channel Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('public')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  type === 'public'
                    ? 'border-brand-500 bg-brand-500/10 shadow-glow-sm'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Globe className="w-4 h-4 text-brand-400" />
                  <span>Public</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">Anyone in the workspace can view and join</p>
              </button>

              <button
                type="button"
                onClick={() => setType('private')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  type === 'private'
                    ? 'border-brand-500 bg-brand-500/10 shadow-glow-sm'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <Lock className="w-4 h-4 text-brand-400" />
                  <span>Private</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">Only invited members can view this channel</p>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-sm shadow-glow flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>Create Channel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
