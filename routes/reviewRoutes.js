const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  listReviews,
  upsertReview,
  deleteReview,
} = require('../controllers/reviewController');

const router = express.Router();

router.get('/', listReviews);
router.post('/', authMiddleware, upsertReview);
router.delete('/:id', authMiddleware, deleteReview);

module.exports = router;
