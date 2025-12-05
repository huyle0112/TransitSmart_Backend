/**
 * Routing Service - Provides geometry for route segments
 */

/**
 * Get geometries for all segments in a route
 * @param {Array} segments - Array of route segments
 * @param {Map} stopMap - Map of stop IDs to stop objects
 * @returns {Promise<Array>} Array of geometries (coordinates) for each segment
 */
async function getSegmentGeometries(segments, stopMap) {
  const geometries = [];

  for (const segment of segments) {
    // Get all stop coordinates for this segment
    const segmentCoords = segment.stops
      .map(stopId => stopMap.get(stopId))
      .filter(stop => stop)
      .map(stop => [stop.coords.lat, stop.coords.lng]);

    if (segmentCoords.length < 2) {
      geometries.push(null);
      continue;
    }

    // For walking segments, use straight line between stops
    if (segment.mode === 'walk') {
      geometries.push(segmentCoords);
      continue;
    }

    // For transit segments, use all stop coordinates to draw the route
    // This creates a polyline connecting all stops in the segment
    geometries.push(segmentCoords);
  }

  return geometries;
}

/**
 * Get route geometry from OSRM (optional - for future enhancement)
 * @param {Array} waypoints - Array of {lat, lng} waypoints
 * @returns {Promise<Array|null>} Array of [lat, lng] coordinates or null
 */
async function getRouteGeometry(waypoints) {
  // Optional: Integrate with OSRM or other routing service for more accurate routes
  // For now, return null to use fallback (direct connection between waypoints)
  return null;
}

module.exports = {
  getSegmentGeometries,
  getRouteGeometry,
};

