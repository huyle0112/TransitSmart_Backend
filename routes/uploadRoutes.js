const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../controllers/uploadController');

const router = express.Router();

// POST /api/upload/avatar - Upload user avatar (protected)
router.post('/avatar', authMiddleware, uploadAvatar);

module.exports = router;
