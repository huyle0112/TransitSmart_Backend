const {
  searchStopsAndLines,
  getLineById,
  getStopById,
} = require('../utils/graph');

exports.searchLines = (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập từ khoá tìm kiếm.' });
  }

  const results = searchStopsAndLines(q).slice(0, 10);
  if (!results.length) {
    return res
      .status(404)
      .json({ message: 'Không tìm thấy thông tin cho tuyến bạn yêu cầu.' });
  }

  res.json({ query: q, results });
};

exports.getLineDetails = (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'Thiếu id tuyến cần tra cứu.' });
  }

  const line = getLineById(id);
  if (!line) {
    return res
      .status(404)
      .json({ message: 'Không tìm thấy thông tin cho tuyến bạn yêu cầu.' });
  }

  const stops = line.stops
    .map((stopId) => getStopById(stopId))
    .filter(Boolean);

  res.json({
    ...line,
    stops,
    path: stops.map((stop) => stop.coords),
  });
};

