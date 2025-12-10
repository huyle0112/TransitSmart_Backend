const prisma = require("../config/prisma");

module.exports = {
    getAll: () =>
        prisma.routes.findMany({
            include: { trips: true }
        }),

    getById: (id) =>
        prisma.routes.findUnique({
            where: { id },
            include: { trips: true }
        }),

    getByType: (type) =>
        prisma.routes.findMany({
            where: { type }
        }),
    searchByName: (name) =>
        prisma.routes.findMany({
            where: {
                long_name: {
                    contains: name,
                    mode: 'insensitive'
                }
            }
        }),

    findByName: (name) =>
        prisma.routes.findMany({
            where: {
                long_name: name
            },
            include: {
                trips: true
            }
        })
};
