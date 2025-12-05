const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  listFavorites,
  saveFavorite,
  removeFavorite,
} = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);
router.get('/favorites', listFavorites);
router.post('/favorites', saveFavorite);
router.delete('/favorites', removeFavorite);

module.exports = router;

