const { loadStops, loadRoutes, buildGraphFromGtfs } = require('./gtfsLoader');
const { haversineDistance } = require('./geo');

// Load data from GTFS
const stops = loadStops();
const lines = loadRoutes();
const rawEdges = buildGraphFromGtfs();

const lineMap = new Map(lines.map((line) => [line.id, line]));
const stopMap = new Map(stops.map((stop) => [stop.id, stop]));

function buildAdjacency() {
  const adjacency = new Map();

  const register = (edge) => {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge);
  };

  rawEdges.forEach((edge) => {
    register(edge);
    register({
      ...edge,
      from: edge.to,
      to: edge.from,
    });
  });

  return adjacency;
}

const adjacency = buildAdjacency();

function scoreEdge(edge, filter, previousLineId) {
  if (filter === 'cheapest') {
    // Cheapest: minimize fare (7000đ per line)
    // Heavily penalize new bus lines
    const isNewBusLine =
      edge.mode !== 'walk' &&
      previousLineId &&
      previousLineId !== 'walk' &&
      edge.lineId !== previousLineId;
    const newLinePenalty = isNewBusLine ? 300 : 0; // 300 = very expensive
    return newLinePenalty + edge.duration * 0.1;
  }

  if (filter === 'fewest_transfers') {
    const isTransfer =
      previousLineId &&
      edge.lineId !== previousLineId &&
      edge.mode !== 'walk' &&
      previousLineId !== 'walk';
    // EXTREMELY HEAVY penalty for transfers
    // 500 = prefer 8+ hours on same line over 1 transfer
    const transferPenalty = isTransfer ? 500 : 0;

    // Also penalize walking (prefer staying on bus)
    const walkPenalty = edge.mode === 'walk' ? 50 : 0;

    return transferPenalty + walkPenalty + edge.duration * 0.01 + edge.distance * 0.1;
  }

  // fastest (default) - also penalize transfers but moderately
  const isTransfer =
    previousLineId &&
    edge.lineId !== previousLineId &&
    edge.mode !== 'walk' &&
    previousLineId !== 'walk';
  const transferPenalty = isTransfer ? 30 : 0;
  return transferPenalty + edge.duration + edge.distance * 0.5;
}

function reconstructPath(targetKey, previousMap) {
  const path = [];
  let current = targetKey;

  while (current && previousMap.has(current)) {
    const { prevKey, edge } = previousMap.get(current);
    if (!edge) break;
    path.unshift(edge);
    current = prevKey;
  }

  return path;
}

function dijkstra(startId, endId, filter) {
  const startKey = `${startId}|__`;
  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const visited = new Set();

  const queue = [{ key: startKey, score: 0, stopId: startId, lineId: null }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.score - b.score);
    const current = queue.shift();
    if (!current) break;

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.stopId === endId) {
      return reconstructPath(current.key, previous);
    }

    const neighbors = adjacency.get(current.stopId) || [];
    neighbors.forEach((edge) => {
      const nextLine =
        edge.mode === 'walk' ? 'walk' : edge.lineId || null;
      const nextKey = `${edge.to}|${nextLine || '__'}`;
      const weight = scoreEdge(edge, filter, current.lineId);
      const tentative = (distances.get(current.key) || 0) + weight;

      if (tentative < (distances.get(nextKey) || Number.POSITIVE_INFINITY)) {
        distances.set(nextKey, tentative);
        previous.set(nextKey, {
          prevKey: current.key,
          edge: { ...edge, from: current.stopId },
        });
        queue.push({
          key: nextKey,
          score: tentative,
          stopId: edge.to,
          lineId: nextLine,
        });
      }
    });
  }

  return null;
}

function buildSegments(pathEdges) {
  if (!pathEdges || pathEdges.length === 0) return [];

  const segments = [];
  pathEdges.forEach((edge) => {
    const last = segments[segments.length - 1];
    const normalizedLine = edge.mode === 'walk' ? 'walk' : edge.lineId;
    if (
      last &&
      last.lineId === normalizedLine
    ) {
      last.duration += edge.duration;
      // Don't accumulate cost - fare is fixed per line, not per segment
      last.distance += edge.distance;
      last.to = edge.to;
      last.stops.push(edge.to);
    } else {
      const line = lineMap.get(edge.lineId);
      // Fixed fare per line: 7000-8000 VND for entire trip on that line
      const fixedFare = edge.mode === 'walk' ? 0 : (line?.fare || 7000);

      segments.push({
        mode: edge.mode,
        lineId: normalizedLine,
        lineName: line ? line.name : edge.mode === 'walk' ? 'Đi bộ' : 'Liên tuyến',
        color: line ? line.color : '#666666',
        from: edge.from,
        to: edge.to,
        stops: [edge.from, edge.to],
        duration: edge.duration,
        cost: fixedFare, // Fixed fare per line, not per segment
        distance: edge.distance,
      });
    }
  });

  return segments;
}

function summarizeSegments(segments) {
  return segments.reduce(
    (acc, seg, idx) => {
      acc.totalDuration += seg.duration;
      acc.totalCost += seg.cost;
      acc.totalDistance += seg.distance;
      if (
        idx > 0 &&
        seg.lineId !== 'walk' &&
        seg.lineId !== segments[idx - 1].lineId
      ) {
        acc.transfers += 1;
      }
      return acc;
    },
    { totalDuration: 0, totalCost: 0, totalDistance: 0, transfers: 0 }
  );
}

function pathToCoordinates(segments) {
  const coords = [];
  segments.forEach((segment, idx) => {
    segment.stops.forEach((stopId, stopIdx) => {
      const stop = stopMap.get(stopId);
      if (!stop) return;
      if (
        idx > 0 &&
        stopIdx === 0 &&
        coords.length > 0 &&
        coords[coords.length - 1].stopId === stopId
      ) {
        return;
      }
      coords.push({
        stopId,
        name: stop.name,
        coords: stop.coords,
        type: stop.type,
      });
    });
  });
  return coords;
}

function planRoute(startId, endId, filter) {
  const pathEdges = dijkstra(startId, endId, filter);
  if (!pathEdges) return null;

  const segments = buildSegments(pathEdges);
  const summary = summarizeSegments(segments);
  const coordinates = pathToCoordinates(segments);

  return {
    segments,
    summary,
    coordinates,
    stops: coordinates.map((coord) => coord.stopId),
  };
}

async function planRouteWithGeometry(startId, endId, filter) {
  const pathEdges = dijkstra(startId, endId, filter);
  if (!pathEdges) return null;

  const segments = buildSegments(pathEdges);
  const summary = summarizeSegments(segments);
  const coordinates = pathToCoordinates(segments);

  // Get route geometries for each segment
  const { getSegmentGeometries } = require('../services/routingService');
  const geometries = await getSegmentGeometries(segments, stopMap);

  return {
    segments,
    summary,
    coordinates,
    geometries, // Array of geometry arrays for each segment
    stops: coordinates.map((coord) => coord.stopId),
  };
}

function getLineById(lineId) {
  return lineMap.get(lineId);
}

function getStopById(stopId) {
  return stopMap.get(stopId);
}

function searchStopsAndLines(query) {
  const term = query.trim().toLowerCase();
  const stopMatches = stops
    .filter((stop) => stop.name.toLowerCase().includes(term))
    .map((stop) => ({
      type: 'stop',
      id: stop.id,
      name: stop.name,
      coords: stop.coords,
    }));

  const lineMatches = lines
    .filter(
      (line) =>
        line.name.toLowerCase().includes(term) ||
        line.id.toLowerCase().includes(term)
    )
    .map((line) => ({
      type: 'line',
      id: line.id,
      name: line.name,
      lineType: line.type,
      color: line.color,
    }));

  return [...lineMatches, ...stopMatches];
}

module.exports = {
  planRoute,
  planRouteWithGeometry,
  getLineById,
  getStopById,
  searchStopsAndLines,
  stops,
  lines,
};

