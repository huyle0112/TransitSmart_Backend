const express = require('express');
const router = express.Router();
const { testConnection } = require('../controllers/templateController');

// Route test kết nối
router.get('/test', testConnection);

module.exports = router;
