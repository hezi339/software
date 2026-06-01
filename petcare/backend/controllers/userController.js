const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// 封装sqlite3回调为Promise（简化async/await使用）
const dbGet = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
};

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'petcare_jwt_secret_key_2024';
const JWT_EXPIRES_IN = '7d';
const RESET_TOKEN_EXPIRES_IN = '15m'; // 密码重置令牌有效期15分钟

/**
 * 用户注册 - 新增邮箱验证、异步改造
 */
exports.register = async (req, res) => {
  try {
    const { nickname, password, email } = req.body;

    // 基础校验
    if (!nickname || !password) {
      return res.status(400).json({ message: '昵称和密码不能为空' });
    }
    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ message: '昵称长度必须在2-20个字符之间' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: '密码长度不能少于6位' });
    }

    // 如果提供了邮箱，进行格式校验和重复性检查
    let emailUser = null;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: '邮箱格式不正确' });
      }
      emailUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
      if (emailUser) return res.status(400).json({ message: '该邮箱已被注册' });
    }

    // 检查昵称是否已注册
    const nicknameUser = await dbGet('SELECT * FROM users WHERE nickname = ?', [nickname]);
    if (nicknameUser) return res.status(400).json({ message: '该昵称已被注册' });

    // 加密密码 + 生成用户ID
    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    // 插入数据库
    await dbRun(
        'INSERT INTO users (id, nickname, password, email, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, nickname, hash, email || null, createdAt]
    );

    // 生成token
    const token = jwt.sign({ userId, nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: userId, nickname, email }
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

/**
 * 用户登录 - 异步改造、返回邮箱信息
 */
exports.login = async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ message: '昵称和密码不能为空' });
    }

    // 查询用户
    const user = await dbGet('SELECT * FROM users WHERE nickname = ?', [nickname]);
    if (!user) return res.status(404).json({ message: '该用户尚未注册，请先注册' });

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: '密码错误，请重新输入' });

    // 生成token
    const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: '登录成功',
      token,
      user: { id: user.id, nickname: user.nickname, email: user.email }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

/**
 * 获取当前用户信息 - 异步改造
 */
exports.getUserInfo = async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await dbGet('SELECT id, nickname, email, created_at FROM users WHERE id = ?', [userId]);

    if (!user) return res.status(404).json({ message: '用户不存在' });
    res.json(user);
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

/**
 * 更新用户资料 - 新增邮箱修改、密码校验优化
 */
exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { nickname, email, password } = req.body;

    // 基础校验
    if (!nickname) return res.status(400).json({ message: '昵称不能为空' });
    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ message: '昵称长度必须在2-20个字符之间' });
    }

    // 查询当前用户
    const currentUser = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentUser) return res.status(404).json({ message: '用户不存在' });

    // 检查是否有修改内容
    const isNicknameSame = nickname === currentUser.nickname;
    const isEmailSame = email === currentUser.email;
    const isPasswordEmpty = !password;
    if (isNicknameSame && isEmailSame && isPasswordEmpty) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    // 邮箱修改校验（如有）
    if (email && !isEmailSame) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ message: '邮箱格式不正确' });

      const emailUser = await dbGet('SELECT * FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailUser) return res.status(400).json({ message: '该邮箱已被使用' });
    }

    // 昵称修改校验（如有）
    if (!isNicknameSame) {
      const nicknameUser = await dbGet('SELECT * FROM users WHERE nickname = ? AND id != ?', [nickname, userId]);
      if (nicknameUser) return res.status(400).json({ message: '该昵称已被使用' });
    }

    // 构建更新字段
    const updateFields = ['nickname = ?'];
    const updateValues = [nickname];

    // 邮箱更新
    if (email && !isEmailSame) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    // 密码更新（如有）
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: '密码长度不能少于6位' });

      // 验证新密码与原密码不同
      const isSamePwd = await bcrypt.compare(password, currentUser.password);
      if (isSamePwd) return res.status(400).json({ message: '新密码不能与原密码相同' });

      const hash = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateValues.push(hash);
    }

    // 执行更新
    updateValues.push(userId);
    await dbRun(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    // 返回更新后信息
    const updatedUser = await dbGet('SELECT id, nickname, email FROM users WHERE id = ?', [userId]);
    res.json({ message: '更新成功', user: updatedUser });
  } catch (err) {
    console.error('更新资料失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

/**
 * 申请密码重置 - 新增接口（需配合邮箱服务）
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: '邮箱不能为空' });

    // 查询用户
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ message: '该邮箱未注册' });

    // 生成重置令牌
    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: RESET_TOKEN_EXPIRES_IN });

    // 【可选】实际生产环境需发送邮件（需安装nodemailer）
    // const transporter = nodemailer.createTransport({...}); // 配置邮箱服务
    // await transporter.sendMail({
    //   to: email,
    //   subject: '密码重置链接',
    //   text: `重置链接：http://your-domain/reset?token=${resetToken}（15分钟内有效）`
    // });

    res.json({
      message: '密码重置令牌已生成（示例返回，生产环境建议发邮件）',
      resetToken,
      expiresIn: 900 // 有效期15分钟（秒）
    });
  } catch (err) {
    console.error('申请重置失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

/**
 * 重置密码 - 新增接口
 */
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: '重置令牌和新密码不能为空' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '密码长度不能少于6位' });
    }

    // 验证重置令牌
    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: '重置令牌无效或已过期' });
    }

    // 查询用户
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    // 验证新密码与原密码不同
    const isSamePwd = await bcrypt.compare(newPassword, user.password);
    if (isSamePwd) return res.status(400).json({ message: '新密码不能与原密码相同' });

    // 加密新密码并更新
    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hash, decoded.userId]);

    res.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (err) {
    console.error('重置密码失败:', err);
    res.status(500).json({ message: '服务器内部错误' });
  }
};