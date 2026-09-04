import React from 'react';

const Logo = ({ size = 'md', showText = false, className = '' }) => {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const svgSizeClass = typeof size === 'string' ? sizeMap[size] || 'w-9 h-9' : '';
  const customDimension = typeof size === 'number' ? `${size}px` : undefined;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`relative flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-1.5 border border-slate-800/80 shadow-lg shadow-indigo-500/15 ${svgSizeClass}`}
        style={customDimension ? { width: customDimension, height: customDimension } : undefined}
      >
        {/* SVG SyncSpace Orbit Mark */}
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]"
        >
          <defs>
            <linearGradient id="syncspace-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="syncspace-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#818CF8" />
            </linearGradient>
          </defs>

          {/* Infinity Sync Orbit Loop */}
          <path
            d="M 30,50 C 30,32 45,32 50,50 C 55,68 70,68 70,50 C 70,32 55,32 50,50 C 45,68 30,68 30,50 Z"
            stroke="url(#syncspace-grad-1)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Sync Orbit Nodes */}
          <circle cx="30" cy="50" r="7" fill="#38BDF8" />
          <circle cx="70" cy="50" r="7" fill="#818CF8" />
          <circle cx="50" cy="50" r="5" fill="#F43F5E" />
        </svg>
      </div>

      {showText && (
        <span className="font-extrabold text-slate-100 tracking-tight text-lg sm:text-xl flex items-center">
          Sync
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent ml-0.5">
            Space
          </span>
        </span>
      )}
    </div>
  );
};

export default Logo;
