const express = require('express');
const {
  createChannel,
  getWorkspaceChannels,
  updateChannel,
  updateChannelMembers,
  updateChannelRoles,
} = require('../controllers/channelController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all channel routes
router.use(protect);

router.post('/', createChannel);
router.get('/:workspaceId', getWorkspaceChannels);
router.put('/:id', updateChannel);
router.put('/:id/members', updateChannelMembers);
router.put('/:id/roles', updateChannelRoles);

module.exports = router;
