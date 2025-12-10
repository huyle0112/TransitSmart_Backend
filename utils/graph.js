const { loadStops, loadRoutes, buildGraphFromGtfs } = require('./gtfsLoader');
const { haversineDistance } = require('./geo');

// Global cache for graph data
let stops = null;
let lines = null;
let rawEdges = null;
let adjacency = null;
let lineMap = null;
let stopMap = null;

/**
 * Initialize graph data from database
 */
async function initializeGraph() {
  if (stops && lines && rawEdges) {
    return; // Already initialized
  }

  console.log('🔄 Initializing graph from DATABASE...');

  stops = await loadStops();
  lines = await loadRoutes();
  rawEdges = await buildGraphFromGtfs();

  lineMap = new Map(lines.map((line) => [line.id, line]));
  stopMap = new Map(stops.map((stop) => [stop.id, stop]));
  adjacency = buildAdjacency();

  console.log('✅ Graph initialized successfully');
}

function buildAdjacency() {
  const adj = new Map();

  const register = (edge) => {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge);
  };

  rawEdges.forEach((edge) => {
    register(edge);
    register({
      ...edge,
      from: edge.to,
      to: edge.from,
    });
  });

  return adj;
}

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

async function dijkstra(startId, endId, filter) {
  await initializeGraph(); // Ensure graph is loaded

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
      const path = reconstructPath(current.key, previous);
      return path;
    }

    const neighbors = adjacency.get(current.stopId) || [];

    for (const edge of neighbors) {
      const nextStopId = edge.to;
      const nextLineId = edge.lineId || '__';
      const nextKey = `${nextStopId}|${nextLineId}`;

      if (visited.has(nextKey)) continue;

      const edgeScore = scoreEdge(edge, filter, current.lineId);
      const newScore = current.score + edgeScore;

      if (!distances.has(nextKey) || newScore < distances.get(nextKey)) {
        distances.set(nextKey, newScore);
        previous.set(nextKey, { prevKey: current.key, edge });
        queue.push({
          key: nextKey,
          score: newScore,
          stopId: nextStopId,
          lineId: edge.lineId,
        });
      }
    }
  }

  return [];
}

function groupIntoSegments(path) {
  if (!path.length) return [];

  const segments = [];
  let currentSegment = {
    from: path[0].from,
    to: path[0].to,
    lineId: path[0].lineId,
    lineName: path[0].lineName,
    mode: path[0].mode,
    duration: path[0].duration,
    cost: path[0].cost,
    distance: path[0].distance,
  };

  for (let i = 1; i < path.length; i++) {
    const edge = path[i];

    if (edge.lineId === currentSegment.lineId && edge.mode === currentSegment.mode) {
      currentSegment.to = edge.to;
      currentSegment.duration += edge.duration;
      currentSegment.distance += edge.distance;
    } else {
      segments.push(currentSegment);
      currentSegment = {
        from: edge.from,
        to: edge.to,
        lineId: edge.lineId,
        lineName: edge.lineName,
        mode: edge.mode,
        duration: edge.duration,
        cost: edge.cost,
        distance: edge.distance,
      };
    }
  }

  segments.push(currentSegment);
  return segments;
}

function extractCoordinates(segments) {
  const coordinates = [];
  segments.forEach((seg) => {
    const fromStop = stopMap.get(seg.from);
    const toStop = stopMap.get(seg.to);
    if (fromStop) coordinates.push(fromStop.coords);
    if (toStop) coordinates.push(toStop.coords);
  });
  return coordinates;
}

async function planRouteWithGeometry(fromId, toId, filter = 'fastest') {
  await initializeGraph(); // Ensure graph is loaded

  const path = await dijkstra(fromId, toId, filter);
  if (!path.length) return null;

  const segments = groupIntoSegments(path);

  let totalDuration = 0;
  let totalCost = 0;
  let totalDistance = 0;
  const linesUsed = new Set();

  segments.forEach((seg) => {
    totalDuration += seg.duration;
    totalDistance += seg.distance;
    if (seg.mode !== 'walk' && seg.lineId) {
      linesUsed.add(seg.lineId);
    }
  });

  totalCost = linesUsed.size * 7000;

  const coordinates = extractCoordinates(segments);

  return {
    segments,
    coordinates,
    geometries: [], // Can be populated with detailed route geometries if needed
    summary: {
      totalDuration,
      totalCost,
      totalDistance,
      transferCount: Math.max(0, linesUsed.size - 1),
    },
  };
}

function getStopById(stopId) {
  if (!stopMap) return null;
  return stopMap.get(stopId);
}

module.exports = {
  initializeGraph,
  planRouteWithGeometry,
  stops: async () => {
    await initializeGraph();
    return stops;
  },
  getStopById,
};

