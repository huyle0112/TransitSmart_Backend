const express = require('express');
const { register, login, me } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

const authLimiter = rateLimiter({ windowMs: 60_000, max: 15 });

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authMiddleware, me);

module.exports = router;
