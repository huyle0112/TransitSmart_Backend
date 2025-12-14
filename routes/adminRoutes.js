const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const { listUsers, deleteUser, getStats } = require('../controllers/adminController');

const router = express.Router();

const adminLimiter = rateLimiter({ windowMs: 60_000, max: 30 });

router.use(authMiddleware, adminMiddleware, adminLimiter);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
