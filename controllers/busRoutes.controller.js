const busRoutesService = require('../services/busRoutes.service');

module.exports = {
  async searchBusRoutes(req, res) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: 'Vui lòng cung cấp từ khoá tìm kiếm (q).' });
      }

      const results = await busRoutesService.search(q);
      res.json(results);
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ message: 'Lỗi server khi tìm kiếm tuyến buýt.' });
    }
  },

  async getBusLineDetails(req, res) {
    try {
      const { name } = req.query;
      if (!name) {
        return res.status(400).json({ message: 'Vui lòng cung cấp tên tuyến (name).' });
      }

      const details = await busRoutesService.getLineDetails(name);
      if (!details) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin tuyến buýt.' });
      }

      res.json(details);
    } catch (err) {
      console.error('Details error:', err);
      res.status(500).json({ message: 'Lỗi server khi lấy chi tiết tuyến buýt.' });
    }
  },

  async getRouteSchedule(req, res) {
    try {
      const { routeId } = req.query;
      if (!routeId) {
        return res.status(400).json({ message: 'Vui lòng cung cấp mã lộ trình (routeId).' });
      }

      const schedule = await busRoutesService.getSchedule(routeId);
      res.json(schedule);
    } catch (err) {
      console.error('Schedule error:', err);
      res.status(500).json({ message: 'Lỗi server khi xem lịch trình.' });
    }
  }
};
