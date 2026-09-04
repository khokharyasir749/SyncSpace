import React, { useState } from 'react';
import { X, Layers, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const CreateWorkspaceModal = ({ isOpen, onClose, onWorkspaceCreated }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [customSlug, setCustomSlug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!customSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e) => {
    setCustomSlug(true);
    setSlug(slugify(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    const finalSlug = slug.trim() || slugify(name);
    if (!finalSlug) {
      setError('A valid slug is required');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/workspaces', {
        name: name.trim(),
        slug: finalSlug,
      });

      if (res.data?.success) {
        setName('');
        setSlug('');
        setCustomSlug(false);
        onWorkspaceCreated(res.data.workspace);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create workspace');
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
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Create a Workspace</h2>
            <p className="text-xs text-slate-400">Collaborate with your team in real time</p>
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
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Acme Engineering"
              className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Workspace URL Slug
            </label>
            <div className="flex items-center rounded-xl glass-input px-3.5 py-2 text-sm text-slate-400">
              <span className="text-slate-500 select-none mr-1">syncspace.io/</span>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="acme-engineering"
                className="bg-transparent text-slate-100 outline-none w-full font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Unique alphanumeric identifier for your workspace</p>
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
                  <span>Create Workspace</span>
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

export default CreateWorkspaceModal;
