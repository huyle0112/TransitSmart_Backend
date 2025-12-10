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
        }),

    /**
     * Get upcoming trips for a stop based on current time
     * @param {string} stopId - The stop ID
     * @param {Date} currentTime - Current time (default: now)
     * @param {number} limit - Maximum number of upcoming trips (default: 10)
     */
    getUpcomingTrips: async (stopId, currentTime = new Date(), limit = 10) => {
        // Format current time to HH:MM:SS for TIME comparison
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        const seconds = String(currentTime.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        // Use raw SQL query because Prisma doesn't handle TIME type comparison well
        // IMPORTANT: Cast TIME to TEXT to get real time strings, not JavaScript Date objects
        const stopTimes = await prisma.$queryRawUnsafe(
            `SELECT 
                st.trip_id,
                st.stop_id,
                st.arrival_time::TEXT as arrival_time,
                st.departure_time::TEXT as departure_time,
                st.stop_sequence,
                t.route_id,
                r.id as route_id,
                r.short_name,
                r.long_name,
                r.type,
                r.fare
            FROM stop_times st
            JOIN trips t ON st.trip_id = t.trip_id
            JOIN routes r ON t.route_id = r.id
            WHERE st.stop_id = $1
              AND st.departure_time >= $2::time
            ORDER BY st.departure_time ASC
            LIMIT $3`,
            stopId,
            timeString,
            limit
        );

        return stopTimes;
    },

    /**
     * Get all routes passing through a stop with their next arrival times
     * Tìm TẤT CẢ stops có cùng tọa độ với stop_id, sau đó lấy xe buýt đi qua bất kỳ stop nào
     * @param {string} stopId - The stop ID
     * @param {Date} currentTime - Current time (default: now)
     */
    getRoutesWithArrivals: async (stopId, currentTime = new Date()) => {
        // Format current time to HH:MM:SS
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        const seconds = String(currentTime.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        // Query TẤT CẢ stop_times của các stops có CÙNG TỌA ĐỘ với stopId
        // (Vì có thể có nhiều stop_id khác nhau nhưng cùng vị trí - 2 chiều đối diện)
        const upcomingTrips = await prisma.$queryRawUnsafe(
            `SELECT 
                st.trip_id,
                st.stop_id,
                st.arrival_time::TEXT as arrival_time,
                st.departure_time::TEXT as departure_time,
                st.stop_sequence,
                t.route_id,
                r.id as route_id,
                r.short_name,
                r.long_name,
                r.type,
                r.fare
            FROM stop_times st
            JOIN trips t ON st.trip_id = t.trip_id
            JOIN routes r ON t.route_id = r.id
            WHERE st.stop_id IN (
                SELECT id
                FROM stops
                WHERE (lat, lng) = (
                    SELECT lat, lng FROM stops WHERE id = $1
                )
            )
              AND st.departure_time >= $2::time
            ORDER BY st.departure_time ASC
            LIMIT 50`,
            stopId,
            timeString
        );

        // Group by route and get the next 3 arrival times for each route
        const routeMap = new Map();

        upcomingTrips.forEach(stopTime => {
            // Extract route info from the raw SQL result
            const routeId = stopTime.route_id;
            if (!routeId) return;

            if (!routeMap.has(routeId)) {
                routeMap.set(routeId, {
                    id: routeId,
                    name: stopTime.short_name || stopTime.long_name || routeId,
                    shortName: stopTime.short_name,
                    longName: stopTime.long_name,
                    type: stopTime.type,
                    fare: stopTime.fare,
                    nextArrivals: []
                });
            }

            const routeData = routeMap.get(routeId);
            if (routeData.nextArrivals.length < 3) {
                // Calculate minutes until arrival
                // departure_time is a TIME object or string 'HH:MM:SS'
                let departureTimeStr;
                if (typeof stopTime.departure_time === 'string') {
                    departureTimeStr = stopTime.departure_time;
                } else {
                    // If it's a Date object, extract time portion
                    departureTimeStr = stopTime.departure_time.toTimeString().split(' ')[0];
                }

                const [hours, minutes, seconds] = departureTimeStr.split(':').map(Number);
                const departureMinutes = hours * 60 + minutes;
                const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                let minutesUntil = departureMinutes - currentMinutes;

                // Handle wrap-around for next day schedules
                if (minutesUntil < 0) {
                    minutesUntil += 24 * 60; // Add 24 hours
                }

                if (minutesUntil >= 0 && minutesUntil < 180) { // Only show arrivals within 3 hours
                    routeData.nextArrivals.push({
                        minutesUntil,
                        departureTime: departureTimeStr
                    });
                }
            }
        });

        return Array.from(routeMap.values()).filter(r => r.nextArrivals.length > 0);
    }
};
