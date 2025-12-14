const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');

const ALLOWED_TARGETS = ['route', 'stop'];

function mapReview(review) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    targetType: review.target_type,
    targetId: review.target_id,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
    user: review.users
      ? {
        id: review.users.id,
        name: review.users.name,
        email: review.users.email,
      }
      : null,
  };
}

async function buildSummary(where) {
  const summary = await prisma.reviews.aggregate({
    where,
    _avg: { rating: true },
    _count: true,
  });

  return {
    averageRating: summary._avg.rating ? Number(summary._avg.rating.toFixed(2)) : 0,
    totalReviews: summary._count?._all || 0,
  };
}

exports.listReviews = async (req, res) => {
  const { targetType, targetId } = req.query;

  if (!targetType || !ALLOWED_TARGETS.includes(targetType)) {
    return res.status(400).json({ message: 'Thiếu hoặc sai targetType.' });
  }
  if (!targetId) {
    return res.status(400).json({ message: 'Thiếu targetId.' });
  }

  const where = { target_type: targetType, target_id: targetId };

  try {
    const [items, summary] = await Promise.all([
      prisma.reviews.findMany({
        where,
        include: { users: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
      buildSummary(where),
    ]);

    res.json({
      targetType,
      targetId,
      ...summary,
      reviews: items.map(mapReview),
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải đánh giá.' });
  }
};

exports.upsertReview = async (req, res) => {
  const { targetType, targetId, rating, comment } = req.body || {};

  if (!targetType || !ALLOWED_TARGETS.includes(targetType)) {
    return res.status(400).json({ message: 'Thiếu hoặc sai targetType.' });
  }
  if (!targetId) {
    return res.status(400).json({ message: 'Thiếu targetId.' });
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Điểm đánh giá phải từ 1-5.' });
  }

  try {
    // Check if review exists
    const existingReview = await prisma.reviews.findFirst({
      where: {
        user_id: req.user.sub,
        target_type: targetType,
        target_id: targetId,
      },
    });

    let review;
    if (existingReview) {
      review = await prisma.reviews.update({
        where: { id: existingReview.id },
        data: {
          rating,
          comment,
          updated_at: new Date(),
        },
        include: { users: { select: { id: true, name: true, email: true } } },
      });
    } else {
      review = await prisma.reviews.create({
        data: {
          id: randomUUID(),
          user_id: req.user.sub,
          target_type: targetType,
          target_id: targetId,
          rating,
          comment,
        },
        include: { users: { select: { id: true, name: true, email: true } } },
      });
    }

    const summary = await buildSummary({
      target_type: targetType,
      target_id: targetId,
    });

    res.status(201).json({
      review: mapReview(review),
      summary,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu đánh giá.' });
  }
};

exports.deleteReview = async (req, res) => {
  const userId = req.user.sub;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Thiếu id đánh giá.' });
  }

  try {
    const review = await prisma.reviews.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
    }
    if (review.user_id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền xoá đánh giá này.' });
    }

    await prisma.reviews.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Không thể xoá đánh giá.' });
  }
};
