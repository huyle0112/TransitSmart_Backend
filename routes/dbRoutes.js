const express = require('express');
const router = express.Router();

// Route test kết nối
router.get('/test', dbController.testConnection);

module.exports = router;
