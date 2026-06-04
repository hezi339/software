const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'petcare_jwt_secret_key_2024';

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未授权，请先登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'token无效或已过期' });
    }
    req.user = user;
    next();
  });
};