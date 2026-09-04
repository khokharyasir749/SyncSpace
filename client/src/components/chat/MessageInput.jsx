import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Smile, Paperclip, X, FileText, Loader2, Mic, Trash2, Square } from 'lucide-react';
import api from '../../services/api';
import EmojiPicker from './EmojiPicker';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatTimer = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const MessageInput = ({
  onSendMessage,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
  replyingTo = null,
  onCancelReply,
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [content]);

  // Clean up media stream and timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleInputChange = (e) => {
    setContent(e.target.value);

    if (onTyping) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds 25MB limit.');
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/messages/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success) {
        setAttachment({
          fileUrl: res.data.fileUrl,
          fileType: res.data.fileType,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
        });
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      setUploadError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      setUploadError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);

      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setUploadError('Microphone access denied or not supported in browser');
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  };

  const sendRecording = async () => {
    if (!mediaRecorderRef.current) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const recorder = mediaRecorderRef.current;
    const finalDuration = recordingTime;

    const uploadVoiceNote = async () => {
      try {
        setUploading(true);
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });

        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/messages/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.success) {
          const audioAttachment = {
            content: '',
            fileUrl: res.data.fileUrl,
            fileType: 'audio',
            fileName: res.data.fileName,
            fileSize: res.data.fileSize,
            audioDuration: finalDuration,
            replyTo: replyingTo?._id || null,
          };
          onSendMessage(audioAttachment, audioAttachment);
          if (onCancelReply) onCancelReply();
        }
      } catch (err) {
        console.error('Voice note upload error:', err);
        setUploadError(err.response?.data?.message || 'Failed to upload voice note');
      } finally {
        setUploading(false);
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.onstop = uploadVoiceNote;
      recorder.stop();
    } else {
      uploadVoiceNote();
    }
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if ((!trimmed && !attachment) || disabled || uploading) return;

    if (isTypingRef.current && onTyping) {
      isTypingRef.current = false;
      clearTimeout(typingTimeoutRef.current);
      onTyping(false);
    }

    onSendMessage(
      {
        content: trimmed,
        fileUrl: attachment?.fileUrl || null,
        fileType: attachment?.fileType || null,
        fileName: attachment?.fileName || null,
        fileSize: attachment?.fileSize || null,
        replyTo: replyingTo?._id || null,
      },
      attachment
    );

    setContent('');
    setAttachment(null);
    setUploadError(null);
    setShowEmojiPicker(false);
    if (onCancelReply) onCancelReply();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const canSend = (content.trim().length > 0 || attachment) && !uploading && !disabled;

  return (
    <div className="relative p-3 sm:p-4 bg-transparent">
      {/* Replying To Banner */}
      {replyingTo && (
        <div className="mb-2.5 flex items-center justify-between bg-slate-900/95 border-l-4 border-indigo-500 border-t border-b border-r border-slate-800 rounded-xl p-2 px-3 text-xs animate-in fade-in slide-in-from-bottom-2 shadow-lg">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[11px] font-bold text-indigo-400">
              Replying to {replyingTo.sender?.name || 'Teammate'}
            </span>
            <span className="text-slate-300 truncate text-[11px]">
              {replyingTo.content || replyingTo.fileName || 'Attachment'}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Attachment Preview Card */}
      {attachment && (
        <div className="mb-2.5 flex items-center gap-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2 sm:px-3 max-w-sm animate-in fade-in slide-in-from-bottom-2">
          {attachment.fileType === 'image' ? (
            <img
              src={attachment.fileUrl}
              alt={attachment.fileName}
              className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0 bg-slate-900"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{attachment.fileName}</p>
            <p className="text-[10px] text-slate-400">{formatFileSize(attachment.fileSize)}</p>
          </div>
          <button
            type="button"
            onClick={removeAttachment}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition-colors"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploading Progress Indicator */}
      {uploading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-brand-300 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-xl w-fit animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
          <span>Processing voice note / attachment...</span>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-2 hover:text-rose-200">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Active Voice Note Recording Mode */}
      {isRecording ? (
        <div className="relative flex items-center justify-between gap-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-rose-500/50 px-4 py-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </div>
            <span className="text-xs font-mono font-bold text-rose-400 tracking-wider">
              {formatTimer(recordingTime)}
            </span>

            {/* Animated Audio Waveform Bars */}
            <div className="flex items-center gap-1 h-4 px-2">
              <div className="w-1 bg-brand-400 rounded-full h-3 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 bg-brand-400 rounded-full h-5 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 bg-brand-400 rounded-full h-2 animate-bounce" style={{ animationDelay: '300ms' }} />
              <div className="w-1 bg-brand-400 rounded-full h-4 animate-bounce" style={{ animationDelay: '450ms' }} />
              <div className="w-1 bg-brand-400 rounded-full h-3 animate-bounce" style={{ animationDelay: '200ms' }} />
            </div>

            <span className="text-xs text-slate-300 font-medium hidden sm:inline">Recording Voice Note...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={sendRecording}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-glow-sm transition-all hover:from-rose-500 hover:to-rose-400 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Send voice note"
            >
              <SendHorizontal className="w-4 h-4" />
              <span>Send Voice Note</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Input Container */
        <div className="relative flex items-end gap-2 rounded-2xl bg-white dark:bg-[#161a22]/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 focus-within:border-indigo-600 dark:focus-within:border-indigo-500/60 shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-200 px-3.5 py-2.5">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />

          {/* Paperclip Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-0.5"
            title="Attach image or file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled}
            className={`shrink-0 p-1.5 rounded-xl transition-colors disabled:opacity-30 mb-0.5 ${
              showEmojiPicker
                ? 'text-indigo-400 bg-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
            title="Insert emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Mic Button (Voice Note) */}
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || uploading}
            className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-0.5"
            title="Record Voice Note"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={attachment ? 'Add a caption (optional)...' : placeholder}
            disabled={disabled}
            className="w-full bg-transparent text-slate-100 dark:text-slate-100 light:text-slate-900 placeholder-slate-500 dark:placeholder-slate-500 light:placeholder-slate-400 text-sm outline-none resize-none max-h-40 overflow-y-auto leading-relaxed py-0.5"
          />

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className="shrink-0 p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] hover:shadow-[0_0_20px_rgba(99,102,241,0.55)] border border-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mb-0.5"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-2">
        <span><strong>Return</strong> to send</span>
        <span><strong>Shift + Return</strong> for new line</span>
      </div>
    </div>
  );
};

export default MessageInput;
