import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import Logo from '../components/common/Logo';

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=6366f1',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=8b5cf6',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo&backgroundColor=10b981',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe&backgroundColor=ec4899',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper&backgroundColor=f59e0b',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=06b6d4',
];

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [customAvatar, setCustomAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, error: authError, setError } = useAuth();
  const navigate = useNavigate();

  const currentAvatar = customAvatar.trim() || AVATAR_PRESETS[avatarIndex];

  const handleNextAvatar = () => {
    setCustomAvatar('');
    setAvatarIndex((prev) => (prev + 1) % AVATAR_PRESETS.length);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (setError) setError(null);

    // Client-side validations
    if (!name.trim()) {
      setFormError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setFormError('Please enter your email address');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long');
      return;
    }

    setSubmitting(true);
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      avatar: currentAvatar,
    });
    setSubmitting(false);

    if (result.success) {
      navigate('/', { replace: true });
    }
  };

  const errorMessage = formError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="ambient-glow" />

      <div className="w-full max-w-md relative z-10 my-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <Logo size="lg" showText={true} className="mb-2" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Create your account
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Join your team workspace on SyncSpace
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-card border border-slate-800">
          {/* Avatar Generator Preview */}
          <div className="flex flex-col items-center mb-6 pb-6 border-b border-slate-800/80">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-brand-500/50 p-1 shadow-glow-sm overflow-hidden transition-transform group-hover:scale-105">
                <img
                  src={currentAvatar}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover rounded-xl bg-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={handleNextAvatar}
                title="Shuffle Avatar"
                className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-md transition-transform active:scale-95 flex items-center justify-center cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-brand-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Click shuffle icon to change avatar</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-300 font-medium leading-relaxed">
                {errorMessage}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  disabled={submitting}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={submitting}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={submitting}
                  className="w-full pl-11 pr-11 py-2.5 rounded-xl glass-input text-slate-100 placeholder-slate-500 text-sm outline-none"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 mt-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium text-sm shadow-glow transition-all flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-brand-400 hover:text-brand-300 font-medium transition-colors hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
