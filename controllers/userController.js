const { getFavorites } = require('../data/store');
const { getRoute } = require('../utils/routeStore');

exports.listFavorites = (req, res) => {
  const userId = req.user.sub;
  const items = getFavorites(userId);
  res.json({ favorites: items });
};

exports.saveFavorite = (req, res) => {
  const userId = req.user.sub;
  const { routeId, label } = req.body || {};
  if (!routeId) {
    return res.status(400).json({ message: 'Thiếu routeId cần lưu.' });
  }

  const route = getRoute(routeId);
  if (!route) {
    return res
      .status(404)
      .json({ message: 'Không tìm thấy thông tin lộ trình để lưu.' });
  }

  const favorites = getFavorites(userId);
  const exists = favorites.find((fav) => fav.routeId === routeId);
  if (exists) {
    return res.status(409).json({ message: 'Lộ trình đã tồn tại trong danh sách yêu thích.' });
  }

  const favorite = {
    routeId,
    label: label || `${route.title} (${route.summary.totalDuration} phút)`,
    savedAt: new Date().toISOString(),
    route,
  };

  favorites.push(favorite);
  res.status(201).json({ favorite });
};

exports.removeFavorite = (req, res) => {
  const userId = req.user.sub;
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id lộ trình cần xoá.' });
  }

  const favorites = getFavorites(userId);
  const index = favorites.findIndex((fav) => fav.routeId === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Không tìm thấy lộ trình trong danh sách yêu thích.' });
  }

  favorites.splice(index, 1);
  res.status(204).send();
};

