const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');

/**
 * Record a completed or missed call event
 * POST /api/calls/log
 */
exports.logCall = async (req, res, next) => {
  try {
    const {
      workspaceId,
      workspace,
      caller,
      callerId,
      recipients,
      recipientId,
      recipientIds,
      channel,
      channelId,
      type,
      status,
      duration,
      startedAt,
      endedAt,
    } = req.body;

    const finalWorkspaceId = workspaceId || workspace;
    const finalCallerId = caller || callerId || req.user._id;

    let recList = [];
    if (Array.isArray(recipients) && recipients.length > 0) {
      recList = recipients;
    } else if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recList = recipientIds;
    } else if (recipientId) {
      recList = [recipientId];
    }

    const cleanRecList = recList
      .filter(Boolean)
      .map((r) => (typeof r === 'string' && mongoose.Types.ObjectId.isValid(r) ? new mongoose.Types.ObjectId(r) : r));

    const finalChannelId = channelId || channel || null;

    const callLog = await CallLog.create({
      workspace: finalWorkspaceId,
      caller: finalCallerId,
      recipients: cleanRecList,
      channel: finalChannelId,
      type: type || 'audio',
      status: status || 'completed',
      duration: Number(duration) || 0,
      startedAt: startedAt || new Date(),
      endedAt: endedAt || new Date(),
    });

    const populatedCallLog = await CallLog.findById(callLog._id)
      .populate('caller', 'name email avatar isOnline')
      .populate('recipients', 'name email avatar isOnline')
      .populate('channel', 'name type isPrivate');

    res.status(201).json({
      success: true,
      callLog: populatedCallLog,
    });
  } catch (err) {
    if (typeof next === 'function') {
      next(err);
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

/**
 * Fetch call history logs for logged-in user in current workspace
 * GET /api/calls/history
 */
exports.getCallHistory = async (req, res, next) => {
  try {
    const { workspaceId, page = 1, limit = 50, filter } = req.query;
    const userId = req.user._id;

    const query = {};
    if (workspaceId) {
      query.workspace = workspaceId;
    }

    // Include calls where logged-in user is caller OR recipient OR a channel call in the workspace
    query.$or = [{ caller: userId }, { recipients: userId }, { channel: { $ne: null } }];

    if (filter === 'missed') {
      query.status = { $in: ['missed', 'unanswered', 'rejected'] };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const calls = await CallLog.find(query)
      .sort({ startedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('caller', 'name email avatar isOnline')
      .populate('recipients', 'name email avatar isOnline')
      .populate('channel', 'name type isPrivate');

    const total = await CallLog.countDocuments(query);

    res.status(200).json({
      success: true,
      calls,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    if (typeof next === 'function') {
      next(err);
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
