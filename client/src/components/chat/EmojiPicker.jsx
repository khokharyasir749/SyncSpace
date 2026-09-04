import React, { useState, useEffect, useRef } from 'react';
import { Search, Smile, ThumbsUp, Heart, Sparkles, X } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛',
      '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
      '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
      '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
      '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋',
      '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾',
      '🫡', '🫶', '👀', '👁️', '👅', '👄', '🧑‍💻', '👨‍💻', '👩‍💻', '🧙',
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts & Vibes',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '🔥', '✨', '⚡', '⭐', '🌟', '💥', '💯', '💢', '💨', '💫',
    ],
  },
  {
    id: 'objects',
    name: 'Activities & Fun',
    icon: Sparkles,
    emojis: [
      '🚀', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎯', '🎮', '🕹️',
      '🎲', '🎨', '🎭', '🎤', '🎧', '📱', '💻', '💡', '📚', '☕',
      '🍕', '🍔', '🍟', '🌮', '🍣', '🍿', '🍻', '🥂', '🍷', '🍩',
    ],
  },
];

const EmojiPicker = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji) => emoji.includes(searchQuery.trim()))
    : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis || [];

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-14 right-2 sm:right-6 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col transition-all animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Search Header */}
      <div className="p-2.5 border-b border-slate-800 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emoji..."
            autoFocus
            className="w-full bg-slate-800/80 text-slate-100 text-xs rounded-xl pl-8 pr-3 py-1.5 outline-none border border-slate-700 focus:border-brand-500 placeholder-slate-500"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchQuery && (
        <div className="flex items-center justify-around px-2 py-1.5 border-b border-slate-800/60 bg-slate-950/40">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
                  isActive
                    ? 'text-brand-400 bg-brand-500/10 border border-brand-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2.5 h-52 overflow-y-auto grid grid-cols-7 sm:grid-cols-8 gap-1 scrollbar-thin">
        {filteredEmojis.length > 0 ? (
          filteredEmojis.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => onSelectEmoji(emoji)}
              className="h-8 w-8 flex items-center justify-center text-lg rounded-lg hover:bg-slate-800 transition-transform active:scale-125 select-none"
            >
              {emoji}
            </button>
          ))
        ) : (
          <div className="col-span-8 py-8 text-center text-xs text-slate-500">
            No emojis found
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
