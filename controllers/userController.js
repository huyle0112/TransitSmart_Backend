const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');
const { getRoute } = require('../utils/routeStore');
const { getSearchHistory, deleteSearchHistoryItem } = require('../config/redis');

function mapFavorite(record) {
  const cachedRoute = record.route_data || getRoute(record.route_id);

  return {
    id: record.id,
    routeId: record.route_id,
    title:
      record.title ||
      cachedRoute?.title ||
      `${record.from_stop || 'Điểm đi'} → ${record.to_stop || 'Điểm đến'}`,
    savedAt: record.saved_at,
    summary: cachedRoute?.summary || null,
    route: cachedRoute || null,
  };
}

function mapHistory(record) {
  const hasFrom =
    typeof record.from_lat === 'number' && typeof record.from_lng === 'number';
  const hasTo =
    typeof record.to_lat === 'number' && typeof record.to_lng === 'number';

  return {
    id: record.id,
    title: `${record.from_label || 'Điểm đi'} → ${record.to_label || 'Điểm đến'}`,
    from: hasFrom
      ? {
        label: record.from_label,
        coords: { lat: record.from_lat, lng: record.from_lng },
      }
      : { label: record.from_label },
    to: hasTo
      ? {
        label: record.to_label,
        coords: { lat: record.to_lat, lng: record.to_lng },
      }
      : { label: record.to_label },
    createdAt: record.created_at,
  };
}

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const [favoritesCount, historyCount, reviewCount] = await Promise.all([
      prisma.saved_routes.count({ where: { user_id: userId } }),
      prisma.search_history.count({ where: { user_id: userId } }),
      prisma.reviews.count({ where: { user_id: userId } }),
    ]);

    res.json({
      ...user,
      favoritesCount,
      historyCount,
      reviewCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông tin người dùng.' });
  }
};

exports.listFavorites = async (req, res) => {
  try {
    const favorites = await prisma.saved_routes.findMany({
      where: { user_id: req.user.sub },
      orderBy: { saved_at: 'desc' },
      take: 50,
      select: {
        id: true,
        route_id: true,
        title: true,
        from_stop: true,
        to_stop: true,
        options: true,
        saved_at: true,
        route_data: true,
      },
    });

    res.json({ favorites: favorites.map(mapFavorite) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải danh sách yêu thích.' });
  }
};

exports.saveFavorite = async (req, res) => {
  const userId = req.user.sub;
  const { routeId, label, route } = req.body || {};

  if (!routeId) {
    return res.status(400).json({ message: 'Thiếu routeId cần lưu.' });
  }

  const cachedRoute = getRoute(routeId) || route;
  if (!cachedRoute) {
    return res.status(404).json({ message: 'Không tìm thấy thông tin lộ trình để lưu.' });
  }

  try {
    const favorite = await prisma.saved_routes.upsert({
      where: { user_id_route_id: { user_id: userId, route_id: routeId } },
      update: {
        title: label || cachedRoute.title,
        from_stop: cachedRoute.from?.name || null,
        to_stop: cachedRoute.to?.name || null,
        mode: cachedRoute.filter || cachedRoute.summary?.mode || null,
        options: cachedRoute.summary
          ? `${cachedRoute.summary.totalDuration} phút | ${cachedRoute.summary.totalCost}đ`
          : null,
        route_data: cachedRoute,
      },
      create: {
        id: randomUUID(),
        user_id: userId,
        route_id: routeId,
        title: label || cachedRoute.title,
        from_stop: cachedRoute.from?.name || null,
        to_stop: cachedRoute.to?.name || null,
        mode: cachedRoute.filter || cachedRoute.summary?.mode || null,
        options: cachedRoute.summary
          ? `${cachedRoute.summary.totalDuration} phút | ${cachedRoute.summary.totalCost}đ`
          : null,
        route_data: cachedRoute,
      },
    });

    res.status(201).json({ favorite: mapFavorite(favorite) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu lộ trình lúc này.' });
  }
};

exports.removeFavorite = async (req, res) => {
  const userId = req.user.sub;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id lộ trình cần xoá.' });
  }

  try {
    const favorite = await prisma.saved_routes.findFirst({
      where: { id, user_id: userId },
    });
    if (!favorite) {
      return res.status(404).json({ message: 'Không tìm thấy lộ trình trong danh sách yêu thích.' });
    }

    await prisma.saved_routes.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Không thể xoá lộ trình yêu thích.' });
  }
};

exports.getFavoriteById = async (req, res) => {
  const userId = req.user.sub;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Thiếu id lộ trình.' });
  }

  try {
    const favorite = await prisma.saved_routes.findFirst({
      where: {
        id,
        user_id: userId
      },
      select: {
        id: true,
        route_id: true,
        title: true,
        from_stop: true,
        to_stop: true,
        options: true,
        saved_at: true,
        route_data: true,
      },
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Không tìm thấy lộ trình đã lưu.' });
    }

    res.json({ favorite: mapFavorite(favorite) });
  } catch (error) {
    console.error('Error fetching favorite:', error);
    res.status(500).json({ message: 'Không thể tải lộ trình.' });
  }
};

exports.listHistory = async (req, res) => {
  try {
    // Get search history from Redis (2-hour TTL)
    const redisHistory = await getSearchHistory(req.user.sub.toString());

    // Transform Redis data to match frontend interface
    const history = redisHistory.map(item => ({
      id: item.timestamp.toString(),
      from: item.from,
      to: item.to,
      createdAt: new Date(item.timestamp).toISOString(),
      timestamp: item.timestamp
    }));

    res.json({ history });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử tìm kiếm.' });
  }
};

exports.saveHistory = async (req, res) => {
  const userId = req.user.sub;
  const { from, to } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ message: 'Thiếu thông tin điểm đi/đến.' });
  }

  const getCoord = (point, key) => {
    if (!point?.coords) return null;
    const value = point.coords[key];
    if (typeof value === 'number') return value;
    if (Array.isArray(point.coords) && point.coords.length >= 2) {
      return key === 'lat' ? point.coords[0] : point.coords[1];
    }
    return null;
  };

  try {
    const entry = await prisma.search_history.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        from_label: from.label || from.fullName || '',
        from_lat: getCoord(from, 'lat'),
        from_lng: getCoord(from, 'lng'),
        to_label: to.label || to.fullName || '',
        to_lat: getCoord(to, 'lat'),
        to_lng: getCoord(to, 'lng'),
      },
    });

    res.status(201).json({ item: mapHistory(entry) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu lịch sử tìm kiếm.' });
  }
};

exports.removeHistory = async (req, res) => {
  const userId = req.user.sub;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id lịch sử cần xoá.' });
  }

  try {
    // Delete from Redis using timestamp as ID
    const success = await deleteSearchHistoryItem(userId.toString(), id);

    if (!success) {
      return res.status(404).json({ message: 'Không tìm thấy lịch sử.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting search history:', error);
    res.status(500).json({ message: 'Không thể xoá lịch sử tìm kiếm.' });
  }
};
