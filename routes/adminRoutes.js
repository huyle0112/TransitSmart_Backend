const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { listUsers, deleteUser } = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get('/users', listUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
