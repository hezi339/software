const jwt = require('jsonwebtoken');
const db = require('../db');

// 和 userController 中生成Token的密钥保持一致，避免不匹配
const JWT_SECRET = process.env.JWT_SECRET || 'petcare_jwt_secret_key_2024';

// 封装SQLite查询，和项目其他部分的代码风格统一
const dbGet = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * JWT鉴权中间件（对应示例中的 authenticateToken）
 * 解析JWT并将用户ID注入 req.user.id，兼容现有路由引用
 */
exports.authenticate = async (req, res, next) => {
  try {
    // 1. 从请求头获取Token（格式：Bearer <token>）
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 未提供Token，返回401未授权
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证Token'
      });
    }

    // 2. 验证Token有效性
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. 校验用户是否存在（避免Token被盗用/用户已删除）
    const user = await dbGet('SELECT id, is_admin FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token对应的用户不存在'
      });
    }

    // 4. 将用户信息挂载到req，确保 req.user.id 和 req.user.userId 都被正确注入（兼容现有控制器）
    req.user = {
      id: user.id, // 必须存在，后续控制器依赖此属性
      userId: user.id, // 兼容 userController 中的使用方式
      isAdmin: user.is_admin === 1 // 从数据库读取管理员权限
    };

    next(); // 鉴权通过，进入下一个中间件/控制器
  } catch (err) {
    // Token无效/过期，返回403禁止访问
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token无效或已过期'
      });
    }
    // 其他错误交给全局错误处理中间件
    next(err);
  }
};

/**
 * 管理员权限校验中间件
 * 必须在 authenticate 之后使用，依赖 req.user.id
 */
exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无管理员权限'
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// 导出别名，兼容示例中的 authenticateToken 名称（可选，不影响现有路由）
exports.authenticateToken = exports.authenticate;