const prisma = require("../config/prisma");

module.exports = {
    getAll: () =>
        prisma.stops.findMany(),

    getById: (id) =>
        prisma.stops.findUnique({
            where: { id }
        }),

    create: (data) =>
        prisma.stops.create({
            data
        }),

    getWithTimes: (id) =>
        prisma.stops.findUnique({
            where: { id },
            include: { stop_times: true }
        })
};
