const prisma = require("../prisma/client");

module.exports = {
    getByTripId: (tripId) =>
        prisma.stop_times.findMany({
            where: { trip_id: tripId },
            include: { stop: true }
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
                stop: true,
                trip: true
            }
        })
};
