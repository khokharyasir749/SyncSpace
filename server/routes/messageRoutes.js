const express = require('express');
const {
  getChannelMessages,
  getDmMessages,
  markMessageRead,
  togglePinMessage,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all message routes
router.use(protect);

router.get('/channel/:channelId', getChannelMessages);
router.get('/dm/:conversationId', getDmMessages);
router.put('/:id/read', markMessageRead);
router.put('/:id/pin', togglePinMessage);

module.exports = router;
