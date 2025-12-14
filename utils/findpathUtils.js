const stopsService = require("../services/stops.service");

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Find nearest bus stops from a given coordinate
 * @param {number} lat - Latitude of the point
 * @param {number} lon - Longitude of the point
 * @param {number} limit - Number of nearest stops to return (default: 3)
 * @returns {Promise<Array>} Array of nearest stops with distance
 */
async function findNearestStops(lat, lon, limit = 3) {
    // Get all stops - getAllStops now returns pagination object
    const result = await stopsService.getAllStops(0, 999999); // Get all stops without pagination limit
    const allStops = result.stops || []; // Extract stops array

    // Calculate distance for each stop
    const stopsWithDistance = allStops.map((stop) => ({
        ...stop,
        distance: calculateDistance(lat, lon, stop.lat, stop.lng),
    }));

    // Sort by distance
    const sortedStops = stopsWithDistance.sort((a, b) => a.distance - b.distance);

    // Filter to get stops with unique coordinates (at least 50m apart)
    const uniqueStops = [];
    const minDistanceBetweenStops = 50; // meters

    for (const stop of sortedStops) {
        // Check if this stop's location is unique (not too close to already selected stops)
        const isTooClose = uniqueStops.some(selectedStop => {
            const dist = calculateDistance(
                stop.lat, stop.lng,
                selectedStop.lat, selectedStop.lng
            );
            return dist < minDistanceBetweenStops;
        });

        if (!isTooClose) {
            uniqueStops.push(stop);
        }

        // Stop when we have enough unique stops
        if (uniqueStops.length >= limit) {
            break;
        }
    }

    return uniqueStops;
}

/**
 * Find nearest bus stops from origin and destination coordinates
 * @param {number} originLat - Latitude of origin point
 * @param {number} originLon - Longitude of origin point
 * @param {number} destLat - Latitude of destination point
 * @param {number} destLon - Longitude of destination point
 * @param {number} limit - Number of nearest stops to return for each side (default: 3)
 * @returns {Promise<Object>} Object containing nearest origin and destination stops
 */
async function findNearestStopsFromOriginAndDestination(
    originLat,
    originLon,
    destLat,
    destLon,
    limitOrigin = 3,
    limitDestination = 1
) {
    const [originStops, destinationStops] = await Promise.all([
        findNearestStops(originLat, originLon, limitOrigin),
        findNearestStops(destLat, destLon, limitDestination),
    ]);

    return {
        origin: {
            coordinates: { lat: originLat, lon: originLon },
            nearestStops: originStops,
        },
        destination: {
            coordinates: { lat: destLat, lon: destLon },
            nearestStops: destinationStops,
        },
    };
}

module.exports = {
    calculateDistance,
    findNearestStops,
    findNearestStopsFromOriginAndDestination,
};
