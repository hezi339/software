const db = require('../db');

/**
 * 操作日志中间件
 * 记录用户的每一次敏感操作（登录、增删改数据等）
 */
const logOperation = async (req, res, next) => {
    try {
        // 只记录已登录用户的操作
        if (req.user) {
            const ip = req.ip.replace('::ffff:', '') || 'unknown';
            const method = req.method;
            const path = req.originalUrl;
            const module = path.split('/')[2] || 'other';

            // 插入操作日志到数据库
            db.run(`
        INSERT INTO operation_logs (user_id, operation, module, ip_address)
        VALUES (?, ?, ?, ?)
      `, [req.user.id, method, module, ip]);
        }
    } catch (err) {
        // 日志记录失败不影响主业务
        console.log('日志记录失败：', err.message);
    }

    next();
};

module.exports = { logOperation };