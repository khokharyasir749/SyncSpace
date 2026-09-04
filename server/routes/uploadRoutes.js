const express = require('express');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/messages/upload
 * @desc    Upload message attachment (Image or Document)
 * @access  Private
 */
router.post('/upload', protect, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a file to upload',
      });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio = req.file.mimetype.startsWith('audio/') || /\.(webm|mp3|wav|ogg|m4a)$/i.test(req.file.originalname);
    const fileType = isImage ? 'image' : isAudio ? 'audio' : 'document';
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
