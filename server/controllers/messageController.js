const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');

/**
 * @desc    Get paginated message history for a channel
 * @route   GET /api/messages/channel/:channelId
 * @access  Private
 */
const getChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    // Verify user is a member of the parent workspace
    const workspace = await Workspace.findById(channel.workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isWorkspaceMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this workspace',
      });
    }

    // If channel is private, verify user is in channel members
    if (channel.type === 'private') {
      const isChannelMember = channel.members.some(
        (m) => m.toString() === req.user._id.toString()
      );
      if (!isChannelMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not a member of this private channel',
        });
      }
    }

    // Construct query with cursor pagination
    const query = { channelId };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch messages descending (latest first)
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('sender', 'name email avatar isOnline')
      .populate('readBy', 'name avatar isOnline')
      .populate('deliveredTo', 'name avatar isOnline')
      .populate('reactions.user', 'name avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

    // Return in chronological order (oldest to newest) for client-side chat view
    return res.status(200).json({
      success: true,
      count: messages.length,
      hasMore: messages.length === limitNum,
      messages: messages.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated direct message history
 * @route   GET /api/messages/dm/:conversationId
 * @access  Private
 */
const getDmMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required',
      });
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const rawId = conversationId.toString().replace(/^dm_/, '');
    const userIds = rawId.split('_');
    if (userIds.length === 2 && userIds.every((id) => /^[0-9a-fA-F]{24}$/.test(id))) {
      if (!userIds.includes(req.user._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not a participant in this conversation',
        });
      }
    }

    const query = {
      $or: [
        { conversationId },
        { conversationId: `dm_${rawId}` },
        { conversationId: rawId },
      ],
    };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('sender', 'name email avatar isOnline')
      .populate('readBy', 'name avatar isOnline')
      .populate('deliveredTo', 'name avatar isOnline')
      .populate('reactions.user', 'name avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

    return res.status(200).json({
      success: true,
      count: messages.length,
      hasMore: messages.length === limitNum,
      messages: messages.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark message as read/listened
 * @route   PUT /api/messages/:id/read
 * @access  Private
 */
const markMessageRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          readBy: userId,
          deliveredTo: userId,
        },
      },
      { new: true }
    )
      .populate('sender', 'name email avatar isOnline')
      .populate('readBy', 'name avatar isOnline')
      .populate('deliveredTo', 'name avatar isOnline')
      .populate('reactions.user', 'name avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle pin status on a message
 * @route   PUT /api/messages/:id/pin
 * @access  Private
 */
const togglePinMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const populatedMsg = await Message.findById(message._id)
      .populate('sender', 'name email avatar isOnline')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name email avatar' } });

    return res.status(200).json({
      success: true,
      message: populatedMsg,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChannelMessages,
  getDmMessages,
  markMessageRead,
  togglePinMessage,
};
