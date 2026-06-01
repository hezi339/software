const db = require('../db');

class UserModel {
    // 根据ID查询用户
    static async findById(userId) {
        const user = await db.get('SELECT id, nickname, created_at FROM users WHERE id = ?', [userId]);
        return user;
    }

    // 根据用户名查询用户（登录用）
    static async findByUsername(username) {
        const user = await db.get('SELECT * FROM users WHERE nickname = ?', [username]);
        return user;
    }

    // 创建新用户
    static async create(userData) {
        const { nickname, password } = userData;
        const id = db.generateId(); // 用你db.js里的UUID方法
        await db.run(`
      INSERT INTO users (id, nickname, password)
      VALUES (?, ?, ?)
    `, [id, nickname, password]);
        return { id, nickname };
    }
}

module.exports = UserModel;