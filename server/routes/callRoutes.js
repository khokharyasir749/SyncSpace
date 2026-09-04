const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { logCall, getCallHistory } = require('../controllers/callController');

router.use(protect);

router.post('/log', logCall);
router.get('/history', getCallHistory);

module.exports = router;
