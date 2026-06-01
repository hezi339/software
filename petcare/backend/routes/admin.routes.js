const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

// 管理员所有接口必须登录 + 管理员权限
router.use(authenticate, isAdmin);

// 用户管理
router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);

// 救助动物审核
router.get('/rescue/pending', adminController.getRescueToReview);
router.put('/rescue/:id/review', adminController.reviewRescue);

// 系统配置
router.get('/config', adminController.getSystemConfig);
router.put('/config', adminController.updateConfig);

// 操作日志
router.get('/logs', adminController.getOperationLogs);

module.exports = router;