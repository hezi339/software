const express = require('express');
const router = express.Router();
const { register, login, getUserInfo, updateProfile } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getUserInfo);
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;