const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      default: null,
      index: true,
    },
    conversationId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message sender is required'],
      index: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    fileUrl: {
      type: String,
      default: null,
      trim: true,
    },
    fileType: {
      type: String,
      default: null,
      trim: true,
    },
    fileName: {
      type: String,
      default: null,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    audioDuration: {
      type: Number,
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [
      {
        emoji: {
          type: String,
          required: true,
          trim: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Explicit indices for channelId, conversationId, and createdAt
messageSchema.index({ createdAt: 1 });

// High-performance compound indices for chronological pagination
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Ensure at least channelId or conversationId is provided, and either content or fileUrl is provided
messageSchema.pre('validate', function () {
  if (!this.channelId && !this.conversationId) {
    this.invalidate('channelId', 'Message must belong to either a channel (channelId) or a direct conversation (conversationId)');
  }
  if (!this.content && !this.fileUrl) {
    this.invalidate('content', 'Message must have text content or a file attachment');
  }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
