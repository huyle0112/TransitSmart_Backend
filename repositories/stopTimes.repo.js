const prisma = require("../config/prisma");

module.exports = {
    getByTripId: (tripId) =>
        prisma.stop_times.findMany({
            where: { trip_id: tripId },
            include: { stops: true }
        }),

    create: (data) =>
        prisma.stop_times.create({
            data
        }),

    getFullSchedule: (tripId) =>
        prisma.stop_times.findMany({
            where: { trip_id: tripId },
            orderBy: { stop_sequence: "asc" },
            include: {
                stops: true,
                trips: true
            }
        })
};
