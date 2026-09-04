const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const User = require('../models/User');

/**
 * Format string into URL-friendly slug
 * @param {string} text
 * @returns {string}
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * @desc    Create a new workspace
 * @route   POST /api/workspaces
 * @access  Private
 */
const createWorkspace = async (req, res, next) => {
  try {
    const { name, slug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required',
      });
    }

    const formattedSlug = slugify(slug || name);
    if (!formattedSlug) {
      return res.status(400).json({
        success: false,
        message: 'A valid workspace slug or name is required',
      });
    }

    // Check if slug is already taken
    const existingWorkspace = await Workspace.findOne({ slug: formattedSlug });
    if (existingWorkspace) {
      return res.status(400).json({
        success: false,
        message: 'A workspace with this slug already exists. Please choose a different name or slug.',
      });
    }

    // Create workspace with creator as owner and admin member
    const workspace = await Workspace.create({
      name: name.trim(),
      slug: formattedSlug,
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'admin',
          joinedAt: new Date(),
        },
      ],
    });

    // Automatically create a default #general channel for the workspace
    const defaultChannel = await Channel.create({
      workspaceId: workspace._id,
      name: 'general',
      type: 'public',
      members: [req.user._id],
    });

    let populatedWorkspace = workspace;
    if (workspace && typeof workspace.populate === 'function') {
      try {
        await workspace.populate([
          { path: 'owner', select: 'name email avatar isOnline' },
          { path: 'members.user', select: 'name email avatar isOnline' },
        ]);
        populatedWorkspace = workspace;
      } catch (_) {}
    }

    return res.status(201).json({
      success: true,
      workspace: populatedWorkspace || workspace,
      defaultChannel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all workspaces for the authenticated user
 * @route   GET /api/workspaces
 * @access  Private
 */
const getUserWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      'members.user': req.user._id,
    })
      .populate('owner', 'name email avatar isOnline')
      .populate('members.user', 'name email avatar isOnline')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add / invite a registered user by email to a workspace
 * @route   POST /api/workspaces/:workspaceId/members
 * @access  Private
 */
const addWorkspaceMember = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { email, role = 'member' } = req.body;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId parameter is required',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address of the user to invite is required',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    // Verify requesting user is a member of this workspace
    const isMember = workspace.members.some(
      (m) => (m.user?._id || m.user).toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this workspace to invite teammates',
      });
    }

    // Look up user to add by email
    const userToAdd = await User.findOne({ email: cleanEmail });
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: `No user found with email "${cleanEmail}". Please ensure they have registered an account first.`,
      });
    }

    // Check if user is already a member
    const isAlreadyMember = workspace.members.some(
      (m) => (m.user?._id || m.user).toString() === userToAdd._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: `${userToAdd.name} (${userToAdd.email}) is already a member of this workspace`,
      });
    }

    // Add member to workspace
    workspace.members.push({
      user: userToAdd._id,
      role: role === 'admin' ? 'admin' : 'member',
      joinedAt: new Date(),
    });
    await workspace.save();

    // Automatically add user to all public channels in this workspace
    await Channel.updateMany(
      { workspaceId: workspace._id, type: 'public' },
      { $addToSet: { members: userToAdd._id } }
    );

    // Re-populate and return updated workspace
    const updatedWorkspace = await Workspace.findById(workspaceId)
      .populate('owner', 'name email avatar isOnline')
      .populate('members.user', 'name email avatar isOnline');

    return res.status(200).json({
      success: true,
      message: `Successfully added ${userToAdd.name} to ${workspace.name}`,
      workspace: updatedWorkspace,
      member: {
        _id: userToAdd._id,
        name: userToAdd.name,
        email: userToAdd.email,
        avatar: userToAdd.avatar,
        isOnline: userToAdd.isOnline,
        role: role === 'admin' ? 'admin' : 'member',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWorkspace,
  getUserWorkspaces,
  addWorkspaceMember,
};
