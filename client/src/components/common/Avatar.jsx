import React, { useState } from 'react';

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Avatar = ({ src, name, className = 'w-8 h-8 rounded-xl', textClassName = 'text-xs font-semibold' }) => {
  const [imgError, setImgError] = useState(false);

  const initials = getInitials(name);
  const showFallback = !src || imgError;

  if (showFallback) {
    return (
      <div
        className={`bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center border border-white/10 shadow-sm shrink-0 select-none ${className}`}
        title={name || 'User'}
      >
        <span className={textClassName}>{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'Avatar'}
      onError={() => setImgError(true)}
      className={`object-cover bg-slate-800 border border-slate-700/60 shadow-sm shrink-0 ${className}`}
    />
  );
};

export default Avatar;
