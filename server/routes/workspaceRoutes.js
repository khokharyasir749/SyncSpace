const express = require('express');
const {
  createWorkspace,
  getUserWorkspaces,
  addWorkspaceMember,
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all workspace routes
router.use(protect);

router.route('/')
  .post(createWorkspace)
  .get(getUserWorkspaces);

router.route('/:workspaceId/members')
  .post(addWorkspaceMember);

module.exports = router;
