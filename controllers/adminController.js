const prisma = require('../config/prisma');

exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        reviews: { select: { id: true } },
        saved_routes: { select: { id: true } },
      },
      take: 200,
    });

    const mapped = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
      reviewsCount: u.reviews.length,
      savedRoutesCount: u.saved_routes.length,
    }));

    res.json({ users: mapped });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ message: 'Không thể tải danh sách người dùng.' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id người dùng.' });
  }

  try {
    await prisma.users.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }
    res.status(500).json({ message: 'Không thể xoá người dùng.' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalRoutes, totalStops, totalReviews] = await Promise.all([
      prisma.users.count(),
      prisma.routes.count(),
      prisma.stops.count(),
      prisma.reviews.count(),
    ]);

    res.json({
      totalUsers,
      totalRoutes,
      totalStops,
      totalReviews,
    });
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ message: 'Không thể tải thống kê.' });
  }
};
