const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'petcare_jwt_secret_key_2024';
const JWT_EXPIRES_IN = '7d';

exports.register = (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ message: '昵称和密码不能为空' });
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ message: '昵称长度必须在2-20个字符之间' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: '密码长度不能少于6位' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }

    const userId = uuidv4();

    db.run(
      'INSERT INTO users (id, nickname, password) VALUES (?, ?, ?)',
      [userId, nickname, hash],
      function (err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ message: '该昵称已被注册' });
          }
          return res.status(500).json({ message: '注册失败，请重试' });
        }

        const token = jwt.sign({ userId, nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.status(201).json({
          message: '注册成功',
          token,
          user: {
            id: userId,
            nickname
          }
        });
      }
    );
  });
};

exports.login = (req, res) => {
  const { nickname, password } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ message: '昵称和密码不能为空' });
  }

  db.get('SELECT * FROM users WHERE nickname = ?', [nickname], (err, user) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }

    if (!user) {
      return res.status(404).json({ message: '该用户尚未注册，请先注册' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }

      if (!isMatch) {
        return res.status(401).json({ message: '密码错误，请重新输入' });
      }

      const token = jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          nickname: user.nickname
        }
      });
    });
  });
};

exports.getUserInfo = (req, res) => {
  const { userId } = req.user;

  db.get('SELECT id, nickname, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(user);
  });
};

exports.updateProfile = (req, res) => {
  const { userId } = req.user;
  const { nickname, password } = req.body;

  if (!nickname) {
    return res.status(400).json({ message: '昵称不能为空' });
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ message: '昵称长度必须在2-20个字符之间' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, currentUser) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }

    if (!currentUser) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (!password) {
      if (nickname === currentUser.nickname) {
        return res.status(400).json({ message: '没有任何信息需要修改' });
      }

      checkNicknameAndUpdate(userId, nickname, password, currentUser, res);
    } else {
      bcrypt.compare(password, currentUser.password, (err, isMatch) => {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }

        if (isMatch && nickname === currentUser.nickname) {
          return res.status(400).json({ message: '没有任何信息需要修改' });
        }

        checkNicknameAndUpdate(userId, nickname, password, currentUser, res);
      });
    }
  });
};

function checkNicknameAndUpdate(userId, nickname, password, currentUser, res) {
  if (nickname !== currentUser.nickname) {
    db.get('SELECT * FROM users WHERE nickname = ? AND id != ?', [nickname, userId], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }

      if (existingUser) {
        return res.status(400).json({ message: '该昵称已被使用' });
      }

      updateUserProfile(userId, nickname, password, currentUser.password, res);
    });
  } else {
    updateUserProfile(userId, nickname, password, currentUser.password, res);
  }
}

function updateUserProfile(userId, nickname, password, currentPassword, res) {
  const updateFields = [];
  const updateValues = [];

  updateFields.push('nickname = ?');
  updateValues.push(nickname);

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ message: '密码长度不能少于6位' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }

      updateFields.push('password = ?');
      updateValues.push(hash);
      updateValues.push(userId);

      const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

      db.run(sql, updateValues, function (err) {
        if (err) {
          return res.status(500).json({ message: '更新失败，请重试' });
        }

        db.get('SELECT id, nickname FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) {
            return res.status(500).json({ message: '服务器内部错误' });
          }

          res.json({
            message: '更新成功',
            user
          });
        });
      });
    });
  } else {
    updateValues.push(userId);
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(sql, updateValues, function (err) {
      if (err) {
        return res.status(500).json({ message: '更新失败，请重试' });
      }

      db.get('SELECT id, nickname FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }

        res.json({
          message: '更新成功',
          user
        });
      });
    });
  }
}