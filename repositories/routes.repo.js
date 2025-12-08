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
        })
};
