const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
      lowercase: true,
      maxlength: [80, 'Channel name cannot exceed 80 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['public', 'private'],
        message: '{VALUE} is not a valid channel type',
      },
      default: 'public',
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [250, 'Description cannot exceed 250 characters'],
    },
    avatar: {
      type: String,
      default: '',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Enforce unique channel names within the same workspace
channelSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;
