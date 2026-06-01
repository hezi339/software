const express = require('express');
const router = express.Router();
const {
    register,
    login,
    getUserInfo,
    updateProfile,
    requestPasswordReset,
    resetPassword
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

// 用户注册
router.post('/register', register);
// 用户登录
router.post('/login', login);
// 获取当前用户信息（需登录）
router.get('/me', authenticateToken, getUserInfo);
// 更新用户资料（需登录）
router.put('/profile', authenticateToken, updateProfile);
// 申请密码重置（通过邮箱）
router.post('/request-reset', requestPasswordReset);
// 重置密码（使用重置令牌）
router.post('/reset-password', resetPassword);

module.exports = router;