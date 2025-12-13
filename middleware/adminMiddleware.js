module.exports = function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Bạn không có quyền truy cập tính năng quản trị.' });
  }
  next();
};
