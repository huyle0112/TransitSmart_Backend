const { PrismaClient } = require('@prisma/client');
require('dotenv').config(); // Load DATABASE_URL

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // optional
});

module.exports = prisma;
