const prisma = require('../config/prisma');

// Kiểm tra kết nối
exports.testConnection = async (req, res) => {
    try {
        // Thực hiện query đơn giản: Lấy thời gian hiện tại từ DB
        const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
        // result trả về mảng object. Do pg trả về Date object cho timestamp, JSON.stringify sẽ format lại.
        res.json({
            message: 'Kết nối PostgreSQL qua Prisma thành công!',
            time: result[0].current_time,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'Lỗi kết nối cơ sở dữ liệu (Prisma)',
            error: err.message,
        });
    }
};

// Lấy danh sách users (Model User phải được định nghĩa trong schema.prisma)
exports.getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        // Mã lỗi P2010 hoặc tương tự nếu bảng chưa có
        res.status(500).json({ message: 'Lỗi truy vấn users', error: err.message });
    }
};
