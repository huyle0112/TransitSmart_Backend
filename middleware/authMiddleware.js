const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-mock-key';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Yêu cầu đăng nhập.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const isAdmin = decoded?.email
      ? ADMIN_EMAILS.includes(decoded.email.toLowerCase()) || decoded.isAdmin
      : Boolean(decoded?.isAdmin);

    req.user = { ...decoded, isAdmin };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
  }
};
