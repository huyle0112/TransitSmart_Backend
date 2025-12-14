const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getProfile,
  listFavorites,
  getFavoriteById,
  saveFavorite,
  removeFavorite,
  listHistory,
  saveHistory,
  removeHistory,
} = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);

router.get('/profile', getProfile);

router.get('/favorites', listFavorites);
router.get('/favorites/:id', getFavoriteById);
router.post('/favorites', saveFavorite);
router.delete('/favorites/:id', removeFavorite);

router.get('/history', listHistory);
router.post('/history', saveHistory);
router.delete('/history/:id', removeHistory);

module.exports = router;
