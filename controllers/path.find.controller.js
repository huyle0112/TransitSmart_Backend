const { findNearestStops } = require('../utils/findpathUtils');
const axios = require('axios');
const config = require('../config/env.config');
const { getStopById } = require('../services/stops.service');

async function findPaths(req, res) {
    const { from, to, time } = req.body || {};

    if (!from || !to) {
        return res.status(400).json({
            message: 'Vui lòng cung cấp điểm đi và điểm đến hợp lệ.',
        });
    }

    // Normalize coordinates - support both array [lat, lng] and object {lat, lng} format
    const normalizeCoords = (coords) => {
        if (Array.isArray(coords)) {
            const [lat, lng] = coords;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return null;
            }
            return { lat, lng };
        }
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            return { lat: coords.lat, lng: coords.lng };
        }
        if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
            return { lat: coords.lat, lng: coords.lon };
        }
        return null;
    };

    const fromCoords = normalizeCoords(from);
    const toCoords = normalizeCoords(to);

    if (!fromCoords || !toCoords) {
        return res.status(400).json({
            message: 'Vui lòng cung cấp toạ độ điểm đi và điểm đến hợp lệ.',
        });
    }

    try {
        // Get nearest stops from origin only, use exact destination coordinates

        const originStops = await findNearestStops(
            fromCoords.lat,
            fromCoords.lng,
            3  // 3 nearest origin stops with unique coordinates
        );

        if (!originStops || originStops.length === 0) {
            return res.status(404).json({
                message: 'Không thể xác định trạm xuất phát phù hợp.',
            });
        }

        // Use provided time or default to current time
        const departureTime = time || new Date().toTimeString().split(' ')[0];

        // External API configuration from centralized config
        const apiUrl = config.getRoutingApiUrl(config.externalApis.routingService.endpoints.findRoute);
        const maxTransferValues = config.routeFinding.maxTransferOptions;

        // Create all API calls for each origin stop with exact destination coordinates
        const apiCalls = [];

        for (const originStop of originStops) {
            // Use exact destination coordinates instead of nearest stop
            for (const maxTransfers of maxTransferValues) {
                apiCalls.push({
                    originStop,
                    destCoords: toCoords,
                    maxTransfers,
                    promise: axios.get(apiUrl, {
                        params: {
                            lat_from: originStop.lat,
                            lon_from: originStop.lng,
                            lat_to: toCoords.lat,
                            lon_to: toCoords.lng,
                            time: departureTime,
                            max_transfers: maxTransfers
                        }
                    }).catch(error => {
                        console.error(
                            'API call failed for origin %s to destination (%s, %s) with max_transfers=%s: %s',
                            originStop.id,
                            toCoords.lat,
                            toCoords.lng,
                            maxTransfers,
                            error.message
                        );
                        return null;
                    })
                });
            }
        }

        // Wait for all API calls to complete
        const apiResults = await Promise.all(apiCalls.map(call => call.promise));

        // Process results - need to handle async stop lookups
        const routePromises = [];

        apiResults.forEach((result, index) => {
            if (!result || !result.data) return;

            const { originStop, destCoords, maxTransfers } = apiCalls[index];
            const data = result.data;

            if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
                data.routes.forEach((route, routeIndex) => {
                    // Create async function to process segments with stop data
                    const processRoute = async () => {
                        // Enrich segments with stop coordinates
                        const enrichedSegments = await Promise.all(
                            (data.segments || []).map(async (segment) => {
                                const fromStop = await getStopById(segment.from_stop);
                                const toStop = await getStopById(segment.to_stop);

                                return {
                                    ...segment,
                                    fromStopName: fromStop?.name,
                                    fromStopLat: fromStop?.lat,
                                    fromStopLon: fromStop?.lng,
                                    toStopName: toStop?.name,
                                    toStopLat: toStop?.lat,
                                    toStopLon: toStop?.lng
                                };
                            })
                        );

                        return {
                            route_id: `${originStop.id}_dest_${maxTransfers}_${routeIndex}`,
                            max_transfers: maxTransfers,
                            origin_stop: {
                                id: originStop.id,
                                name: originStop.name,
                                lat: originStop.lat,
                                lon: originStop.lng,
                                distance_from_origin: originStop.distance
                            },
                            destination_coordinates: {
                                lat: destCoords.lat,
                                lng: destCoords.lng
                            },
                            summary: route.summary,
                            details: route.details,
                            segments: enrichedSegments
                        };
                    };

                    routePromises.push(processRoute());
                });
            }
        });

        // Wait for all routes to be processed
        const allRoutes = await Promise.all(routePromises);

        // Filter out invalid routes
        const validRoutes = allRoutes.filter(route =>
            route.details && route.details.total_time_sec > 0
        );

        // Deduplicate routes by segments (keep only unique route patterns)
        const uniqueRoutesMap = new Map();

        validRoutes.forEach(route => {
            // Create a signature for this route based on its segments
            const segmentSignature = route.segments
                .map(seg => seg.lineId)
                .join('->');

            // If we haven't seen this route pattern, or this one is faster
            if (!uniqueRoutesMap.has(segmentSignature)) {
                uniqueRoutesMap.set(segmentSignature, route);
            } else {
                const existing = uniqueRoutesMap.get(segmentSignature);
                if (route.details.total_time_sec < existing.details.total_time_sec) {
                    uniqueRoutesMap.set(segmentSignature, route);
                }
            }
        });

        // Convert map back to array
        const uniqueRoutes = Array.from(uniqueRoutesMap.values());

        if (uniqueRoutes.length === 0) {
            return res.status(404).json({
                message: 'Không tìm thấy lộ trình xe buýt phù hợp.',
                origin: {
                    lat: fromCoords.lat,
                    lng: fromCoords.lng
                },
                destination: {
                    lat: toCoords.lat,
                    lng: toCoords.lng
                },
                nearest_origin_stops: originStops.map(s => ({
                    id: s.id,
                    name: s.name,
                    distance: Math.round(s.distance)
                }))
            });
        }

        // Sort routes by total time (fastest first)
        uniqueRoutes.sort((a, b) => {
            const timeA = a.details.total_time_sec || Infinity;
            const timeB = b.details.total_time_sec || Infinity;
            return timeA - timeB;
        });

        // Return response
        return res.json({
            from: {
                lat: fromCoords.lat,
                lng: fromCoords.lng
            },
            to: {
                lat: toCoords.lat,
                lng: toCoords.lng
            },
            departure_time: departureTime,
            total_routes_found: uniqueRoutes.length,
            routes: uniqueRoutes,
            origin_info: {
                coordinates: {
                    lat: fromCoords.lat,
                    lng: fromCoords.lng
                },
                nearest_stops: originStops.map(s => ({
                    id: s.id,
                    name: s.name,
                    distance_meters: Math.round(s.distance)
                }))
            },
            destination_info: {
                coordinates: {
                    lat: toCoords.lat,
                    lng: toCoords.lng
                },
                type: 'exact_coordinates'
            }
        });

    } catch (error) {
        console.error('Error in findPaths:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

module.exports = {
    findPaths
};
