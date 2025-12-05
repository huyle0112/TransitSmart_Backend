const express = require('express');
const {
  searchLines,
  getLineDetails,
} = require('../controllers/searchController');

const router = express.Router();

router.get('/line', searchLines);
router.get('/line/details', getLineDetails);

module.exports = router;

