const { PrismaClient } = require('@prisma/client');

// Khởi tạo Prisma Client
// Đảm bảo DATABASE_URL đã được cấu hình trong .env
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;
