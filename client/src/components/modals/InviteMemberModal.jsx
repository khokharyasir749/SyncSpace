import React, { useState } from 'react';
import { X, UserPlus, Mail, Shield, CheckCircle2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const InviteMemberModal = ({ isOpen, onClose, workspace, onMemberAdded }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !workspace) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post(`/workspaces/${workspace._id}/members`, {
        email: cleanEmail,
        role,
      });

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Member added successfully!');
        if (onMemberAdded) {
          onMemberAdded(res.data.workspace, res.data.member);
        }
        setTimeout(() => {
          setEmail('');
          setRole('member');
          setSuccessMsg('');
          onClose();
        }, 1200);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to add member to workspace';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setError('');
    setSuccessMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 sm:p-7 shadow-card border border-slate-700/70 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-glow-sm">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Invite to Workspace</h2>
            <p className="text-xs text-slate-400">
              Add a teammate to <span className="text-brand-300 font-semibold">{workspace.name}</span>
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Teammate Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@syncspace.io"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
                autoFocus
                required
                disabled={loading || !!successMsg}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              The user must have an existing SyncSpace account registered with this email.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Role in Workspace
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('member')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  role === 'member'
                    ? 'border-brand-500 bg-brand-500/15 text-white shadow-glow-sm'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-brand-400" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-100">Member</p>
                  <p className="text-[10px] text-slate-400">Can view & chat</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'border-brand-500 bg-brand-500/15 text-white shadow-glow-sm'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-brand-400" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-100">Admin</p>
                  <p className="text-[10px] text-slate-400">Full management</p>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!successMsg || !email.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-sm shadow-glow flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <span>Add Teammate</span>
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

export default InviteMemberModal;
