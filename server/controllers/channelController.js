const Channel = require('../models/Channel');
const Workspace = require('../models/Workspace');

/**
 * Format string into valid channel name
 * @param {string} text
 * @returns {string}
 */
const sanitizeChannelName = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/^-+|-+$/g, '');
};

/**
 * @desc    Create a channel within a workspace
 * @route   POST /api/channels
 * @access  Private
 */
const createChannel = async (req, res, next) => {
  try {
    const { workspaceId, name, type, members } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId is required',
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Channel name is required',
      });
    }

    const formattedName = sanitizeChannelName(name);
    if (!formattedName) {
      return res.status(400).json({
        success: false,
        message: 'A valid alphanumeric channel name is required',
      });
    }

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    // Validate user is member of workspace
    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this workspace',
      });
    }

    // Check if channel already exists in this workspace
    const existingChannel = await Channel.findOne({
      workspaceId,
      name: formattedName,
    });

    if (existingChannel) {
      return res.status(400).json({
        success: false,
        message: `Channel #${formattedName} already exists in this workspace`,
      });
    }

    // Consolidate members: include creator by default
    const channelMembers = new Set([req.user._id.toString()]);
    if (Array.isArray(members)) {
      members.forEach((m) => {
        if (m) channelMembers.add(m.toString());
      });
    }

    const channel = await Channel.create({
      workspaceId,
      name: formattedName,
      type: type === 'private' ? 'private' : 'public',
      creator: req.user._id,
      admins: [req.user._id],
      members: Array.from(channelMembers),
    });

    return res.status(201).json({
      success: true,
      channel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all accessible channels in a workspace
 * @route   GET /api/channels/:workspaceId
 * @access  Private
 */
const getWorkspaceChannels = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId parameter is required',
      });
    }

    // Verify workspace existence and user membership
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this workspace',
      });
    }

    // Return public channels OR private channels where user is in members array
    const channels = await Channel.find({
      workspaceId,
      $or: [
        { type: 'public' },
        { type: 'private', members: req.user._id },
      ],
    })
      .populate('members admins', 'name email avatar isOnline')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: channels.length,
      channels,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update channel details (name, description, avatar)
 * @route   PUT /api/channels/:id
 * @access  Private
 */
const updateChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, avatar } = req.body;

    const channel = await Channel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    if (name) {
      const formattedName = sanitizeChannelName(name);
      if (formattedName) channel.name = formattedName;
    }

    if (description !== undefined) {
      channel.description = description;
    }

    if (avatar !== undefined) {
      channel.avatar = avatar;
    }

    await channel.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate('members admins', 'name email avatar isOnline');

    return res.status(200).json({
      success: true,
      channel: populatedChannel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update channel members (add/remove)
 * @route   PUT /api/channels/:id/members
 * @access  Private
 */
const updateChannelMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { members } = req.body;

    const channel = await Channel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    if (Array.isArray(members)) {
      if (channel.creator) {
        const creatorIdStr = channel.creator.toString();
        const isCreatorIncluded = members.some((m) => m?.toString() === creatorIdStr);
        if (!isCreatorIncluded) {
          return res.status(400).json({
            success: false,
            message: 'Cannot remove channel creator',
          });
        }
      }

      channel.members = members;
      await channel.save();
    }

    const populatedChannel = await Channel.findById(channel._id)
      .populate('members admins', 'name email avatar isOnline');

    return res.status(200).json({
      success: true,
      channel: populatedChannel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Promote/Demote member to/from Channel Admin
 * @route   PUT /api/channels/:id/roles
 * @access  Private (Channel Admins only)
 */
const updateChannelRoles = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetUserId, makeAdmin } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId is required',
      });
    }

    const channel = await Channel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    const isRequesterAdmin =
      (channel.admins || []).some(
        (a) => a.toString() === req.user._id.toString()
      ) || (channel.creator && channel.creator.toString() === req.user._id.toString());

    if (!isRequesterAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only channel admins can manage member roles',
      });
    }

    let adminSet = new Set((channel.admins || []).map((a) => a.toString()));
    if (makeAdmin) {
      adminSet.add(targetUserId.toString());
    } else {
      adminSet.delete(targetUserId.toString());
    }

    channel.admins = Array.from(adminSet);
    await channel.save();

    const populatedChannel = await Channel.findById(channel._id)
      .populate('members admins', 'name email avatar isOnline');

    return res.status(200).json({
      success: true,
      channel: populatedChannel,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChannel,
  getWorkspaceChannels,
  updateChannel,
  updateChannelMembers,
  updateChannelRoles,
};
