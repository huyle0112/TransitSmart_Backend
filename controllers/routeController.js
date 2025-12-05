const { v4: uuidv4 } = require('uuid');
const { planRouteWithGeometry, stops, getStopById } = require('../utils/graph');
const { findNearestStop, haversineDistance } = require('../utils/geo');
const { saveRoute, getRoute } = require('../utils/routeStore');

function buildSegmentSteps(segments) {
  return segments.map((segment, index) => {
    const fromStop = getStopById(segment.from);
    const toStop = getStopById(segment.to);
    const verb =
      segment.mode === 'walk'
        ? 'Đi bộ'
        : segment.mode === 'train'
        ? 'Đi tàu'
        : 'Đi xe buýt';

    // Determine if this is a transfer point
    const isTransfer = index > 0 &&
                      segment.mode !== 'walk' &&
                      segments[index - 1].mode !== 'walk';

    // Generate wait time for transit segments
    const waitTime = segment.mode !== 'walk' ? randomWaitTime() : 0;

    return {
      title: `${verb} ${segment.mode === 'walk' ? '' : segment.lineName}`.trim(),
      instruction:
        segment.mode === 'walk'
          ? `Đi bộ tới ${toStop?.name || 'điểm kế tiếp'}`
          : `Lên tuyến ${segment.lineName} từ ${fromStop?.name} đến ${toStop?.name}`,
      duration: segment.duration,
      cost: segment.cost,
      distance: segment.distance,
      lineId: segment.lineId,
      lineName: segment.lineName,
      from: fromStop,
      to: toStop,
      isTransfer: isTransfer,
      waitTime: waitTime,
      status: segment.mode === 'walk' ? null : randomStatus(waitTime),
    };
  });
}

function randomWaitTime() {
  // Random wait time between 0-15 minutes
  const waitTimes = [0, 0, 2, 3, 5, 5, 7, 10, 12, 15];
  return waitTimes[Math.floor(Math.random() * waitTimes.length)];
}

function randomStatus(waitTime = 0) {
  if (waitTime === 0) return 'Đúng giờ';
  if (waitTime <= 3) return `Sớm ${waitTime} phút`;
  return `Trễ ${waitTime} phút`;
}

function buildRoutePayload({ filter, planResult, fromStop, toStop, fromCoords, toCoords }) {
  const id = uuidv4();
  const segments = planResult.segments;
  const steps = buildSegmentSteps(segments);

  const startTime = new Date();
  const totalMinutes = planResult.summary.totalDuration;

  // Calculate walking distance/time from user location to first stop
  const startWalkDistance = haversineDistance(fromCoords, fromStop.coords);
  const startWalkTime = Math.round((startWalkDistance * 1000) / 80); // 80 m/min walk speed

  // Calculate walking distance/time from last stop to destination
  const endWalkDistance = haversineDistance(toCoords, toStop.coords);
  const endWalkTime = Math.round((endWalkDistance * 1000) / 80);

  const totalMinutesWithWalk = totalMinutes + startWalkTime + endWalkTime;
  const arrivalTime = new Date(startTime.getTime() + totalMinutesWithWalk * 60000);

  const route = {
    id,
    filter,
    title:
      filter === 'fastest'
        ? 'Nhanh nhất'
        : filter === 'fewest_transfers'
        ? 'Ít chuyển tuyến'
        : 'Rẻ nhất',
    from: fromStop,
    to: toStop,
    fromCoords,
    toCoords,
    segments,
    steps,
    coordinates: planResult.coordinates,
    geometries: planResult.geometries, // Route geometries for drawing on map
    summary: {
      ...planResult.summary,
      totalDuration: totalMinutesWithWalk,
      startWalkDistance: startWalkDistance,
      startWalkTime: startWalkTime,
      endWalkDistance: endWalkDistance,
      endWalkTime: endWalkTime,
      departureTime: startTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
    },
    notices: startWalkDistance > 0.5 || endWalkDistance > 0.5 ? [
      startWalkDistance > 0.5 ? `Đi bộ ${(startWalkDistance * 1000).toFixed(0)}m tới trạm đầu tiên` : null,
      endWalkDistance > 0.5 ? `Đi bộ ${(endWalkDistance * 1000).toFixed(0)}m từ trạm cuối tới đích` : null,
    ].filter(Boolean) : [],
  };

  saveRoute(route);
  return route;
}

exports.findRoutes = async (req, res) => {
  const { from, to, filter } = req.body || {};

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
    return null;
  };

  const fromCoords = normalizeCoords(from);
  const toCoords = normalizeCoords(to);

  if (!fromCoords || !toCoords) {
    return res.status(400).json({
      message: 'Vui lòng cung cấp toạ độ điểm đi và điểm đến hợp lệ.',
    });
  }

  const fromStop = findNearestStop(fromCoords);
  const toStop = findNearestStop(toCoords);

  if (!fromStop || !toStop) {
    return res.status(404).json({
      message: 'Không thể xác định trạm phù hợp từ thông tin vị trí.',
    });
  }

  // Kiểm tra khoảng cách thực tế giữa 2 điểm gốc
  const actualDistance = haversineDistance(fromCoords, toCoords);

  // Nếu 2 điểm thực sự rất gần nhau (< 200m), báo lỗi
  if (actualDistance < 0.2) {
    return res.status(400).json({
      message: 'Điểm đi và điểm đến quá gần nhau (dưới 200m). Bạn có thể đi bộ.',
    });
  }

  // Nếu 2 điểm cùng trạm gần nhất nhưng xa nhau hơn, đề xuất đi bộ
  if (fromStop.id === toStop.id) {
    const walkTime = Math.round((actualDistance * 1000) / 80); // 80 m/min
    return res.status(200).json({
      from: fromStop,
      to: toStop,
      walkingRoute: {
        distance: actualDistance,
        duration: walkTime,
        message: `Khoảng cách giữa 2 địa điểm là ${(actualDistance * 1000).toFixed(0)}m. Đề xuất đi bộ khoảng ${walkTime} phút.`,
      },
      routes: [], // Không có route xe buýt
    });
  }

  const filters = filter
    ? [filter]
    : ['fastest', 'fewest_transfers', 'cheapest'];

  const results = await Promise.all(
    filters.map(async (criterion) => {
      const planResult = await planRouteWithGeometry(fromStop.id, toStop.id, criterion);
      if (!planResult) return null;

      return buildRoutePayload({
        filter: criterion,
        planResult,
        fromStop,
        toStop,
        fromCoords,
        toCoords,
      });
    })
  ).then(routes => routes.filter(Boolean));

  if (!results.length) {
    // Tính khoảng cách thực tế
    const distanceKm = haversineDistance(fromCoords, toCoords);
    const distanceText = distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(2)}km`;

    return res.status(404).json({
      message: 'Không tìm thấy lộ trình xe buýt phù hợp.',
      details: {
        distance: distanceText,
        fromStop: {
          id: fromStop.id,
          name: fromStop.name,
          coords: fromStop.coords
        },
        toStop: {
          id: toStop.id,
          name: toStop.name,
          coords: toStop.coords
        },
        reason: distanceKm > 50
          ? 'Khoảng cách quá xa (>50km). Vui lòng thử các điểm gần hơn.'
          : 'Có thể chưa có tuyến xe buýt kết nối giữa 2 điểm này. Vui lòng thử tìm kiếm các trạm gần đó hoặc sử dụng điểm trung gian.',
        suggestions: [
          'Thử tìm stops gần điểm xuất phát và đích',
          'Kiểm tra xem có tuyến xe nào đi qua khu vực gần đó',
          distanceKm < 2 ? 'Với khoảng cách ngắn này, bạn có thể cân nhắc đi bộ hoặc sử dụng phương tiện khác' : null
        ].filter(Boolean)
      }
    });
  }

  const summaries = results.map((route) => ({
    id: route.id,
    filter: route.filter,
    title: route.title,
    summary: route.summary,
    from: route.from,
    to: route.to,
    segments: route.segments.map((segment) => ({
      lineId: segment.lineId,
      lineName: segment.lineName,
      mode: segment.mode,
      duration: segment.duration,
      cost: segment.cost,
    })),
  }));

  return res.json({
    from: fromStop,
    to: toStop,
    routes: summaries,
  });
};

exports.getRouteDetails = (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id lộ trình' });
  }

  const route = getRoute(id);
  if (!route) {
    return res
      .status(404)
      .json({ message: 'Không tìm thấy thông tin lộ trình.' });
  }

  return res.json(route);
};

exports.getNearbyStops = (req, res) => {
  const { lat, lng } = req.query;
  if (typeof lat === 'undefined' || typeof lng === 'undefined') {
    return res
      .status(400)
      .json({ message: 'Thiếu thông tin vị trí lat & lng.' });
  }

  const coords = { lat: Number(lat), lng: Number(lng) };
  if (Number.isNaN(coords.lat) || Number.isNaN(coords.lng)) {
    return res.status(400).json({ message: 'Toạ độ không hợp lệ.' });
  }

  const nearby = stops
    .map((stop) => {
      const distanceKm = haversineDistance(coords, stop.coords);
      return {
        ...stop,
        distanceKm,
        distanceText:
          distanceKm < 1
            ? `${Math.round(distanceKm * 1000)} m`
            : `${distanceKm.toFixed(2)} km`,
        walkingDuration: Math.round((distanceKm * 1000) / 80), // 80 m/min walk
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);

  return res.json({ origin: coords, stops: nearby });
};

