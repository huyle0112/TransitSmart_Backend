const prisma = require("../config/prisma");

module.exports = {
    getAll: () =>
        prisma.trips.findMany({
            include: {
                stop_times: true,
                routes: true
            }
        }),

    getById: (tripId) =>
        prisma.trips.findUnique({
            where: { trip_id: tripId },
            include: {
                stop_times: true,
                routes: true
            }
        }),

    getByRouteId: (routeId) =>
        prisma.trips.findMany({
            where: { route_id: routeId },
            include: { stop_times: true }
        }),

    create: (data) =>
        prisma.trips.create({
            data
        })
};
