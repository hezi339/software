const db = require('../db');

// 封装 SQLite Promise 方法（和你的 userController 保持一致）
const dbGet = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
};

// 常量定义（避免魔法字符串）
const RESCUE_STATUS = {
    PENDING: '待救助',
    RESCUED: '已救助',
    REJECTED: '拒绝'
};

/**
 * 管理员：获取所有用户列表
 */
exports.getUsers = async (req, res) => {
    try {
        const users = await dbAll(`
      SELECT id, nickname, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `);

        res.status(200).json({
            success: true,
            message: '获取用户列表成功',
            data: users
        });
    } catch (err) {
        console.error('获取用户列表失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：修改用户权限
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin } = req.body;

        // 参数校验
        if (![0, 1].includes(isAdmin)) {
            return res.status(400).json({
                success: false,
                message: '权限值非法，只能是 0 或 1',
                data: null
            });
        }

        // 校验用户是否存在
        const user = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在',
                data: null
            });
        }

        // 更新权限
        await dbRun(
            'UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [isAdmin, id]
        );

        res.status(200).json({
            success: true,
            message: '用户权限修改成功',
            data: null
        });
    } catch (err) {
        console.error('修改用户权限失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：获取待审核救助信息
 */
exports.getRescueToReview = async (req, res) => {
    try {
        const rescues = await dbAll(`
      SELECT * FROM rescue_animals 
      WHERE status = ? 
      ORDER BY created_at DESC
    `, [RESCUE_STATUS.PENDING]);

        res.status(200).json({
            success: true,
            message: '获取待审核救助信息成功',
            data: rescues
        });
    } catch (err) {
        console.error('获取待审核救助失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：审核救助信息（修复 reviewNote 入库）
 */
exports.reviewRescue = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewNote } = req.body;

        // 参数校验
        const validStatus = [RESCUE_STATUS.RESCUED, RESCUE_STATUS.REJECTED];
        if (!validStatus.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `审核状态只能是：${validStatus.join('、')}`,
                data: null
            });
        }

        // 校验救助记录是否存在
        const rescue = await dbGet('SELECT id FROM rescue_animals WHERE id = ?', [id]);
        if (!rescue) {
            return res.status(404).json({
                success: false,
                message: '救助信息不存在',
                data: null
            });
        }

        // 执行审核（修复：reviewNote 入库）
        await dbRun(`
      UPDATE rescue_animals 
      SET status = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, reviewNote || '', id]);

        res.status(200).json({
            success: true,
            message: '救助信息审核成功',
            data: null
        });
    } catch (err) {
        console.error('审核救助信息失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：获取系统配置
 */
exports.getSystemConfig = async (req, res) => {
    try {
        const configs = await dbAll('SELECT * FROM system_configs');
        res.status(200).json({
            success: true,
            message: '获取系统配置成功',
            data: configs
        });
    } catch (err) {
        console.error('获取系统配置失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：更新/新增系统配置（修复存在性判断）
 */
exports.updateConfig = async (req, res) => {
    try {
        const { key, value, description } = req.body;

        // 参数校验
        if (!key || !value) {
            return res.status(400).json({
                success: false,
                message: '配置键和配置值不能为空',
                data: null
            });
        }

        // 判断配置是否存在
        const existing = await dbGet('SELECT id FROM system_configs WHERE config_key = ?', [key]);

        if (existing) {
            // 更新
            await dbRun(`
        UPDATE system_configs 
        SET config_value = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE config_key = ?
      `, [value, description || '', key]);
        } else {
            // 新增
            await dbRun(`
        INSERT INTO system_configs (config_key, config_value, description) 
        VALUES (?, ?, ?)
      `, [key, value, description || '']);
        }

        res.status(200).json({
            success: true,
            message: '系统配置保存成功',
            data: null
        });
    } catch (err) {
        console.error('更新系统配置失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};

/**
 * 管理员：获取操作日志（新增分页）
 */
exports.getOperationLogs = async (req, res) => {
    try {
        // 分页参数
        const page = parseInt(req.query.page) || 1;
        const size = parseInt(req.query.size) || 10;
        const offset = (page - 1) * size;

        // 查询日志列表
        const logs = await dbAll(`
      SELECT * FROM operation_logs 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [size, offset]);

        // 查询总条数
        const total = await dbGet('SELECT COUNT(*) AS count FROM operation_logs');

        res.status(200).json({
            success: true,
            message: '获取操作日志成功',
            data: {
                list: logs,
                total: total.count,
                page,
                size
            }
        });
    } catch (err) {
        console.error('获取操作日志失败:', err);
        res.status(500).json({ success: false, message: '服务器错误', data: null });
    }
};