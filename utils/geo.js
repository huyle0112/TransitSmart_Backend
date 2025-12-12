const { loadStops } = require('./gtfsLoader');

const EARTH_RADIUS_KM = 6371;

const toRad = (value) => (value * Math.PI) / 180;

function haversineDistance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const c =
    sinLat * sinLat +
    sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);

  const centralAngle = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return EARTH_RADIUS_KM * centralAngle;
}

async function findNearestStop(coords) {
  let nearest = null;
  let minDistance = Number.POSITIVE_INFINITY;

  const stops = await loadStops();
  stops.forEach((stop) => {
    const distance = haversineDistance(coords, stop.coords);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { ...stop, distanceKm: distance };
    }
  });

  return nearest;
}

module.exports = {
  haversineDistance,
  findNearestStop,
};

