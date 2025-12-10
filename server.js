require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routeRoutes = require('./routes/routeRoutes');
const searchRoutes = require('./routes/searchRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dbRoutes = require('./routes/dbRoutes');
const stopRoutes = require('./routes/stops.routes');
const busRoutes = require('./routes/busRoutes.routes');
const { getNearbyStops } = require('./controllers/routeController');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize GTFS data on startup
// console.log(' Initializing GTFS data...');
// const { loadStops, loadRoutes } = require('./utils/gtfsLoader');
// const stops = loadStops();
// const routes = loadRoutes();
// console.log(` Loaded ${stops.length} stops and ${routes.length} routes`);
// Initialize graph to build edges
// const { stops: graphStops } = require('./utils/graph');
// console.log(`Graph initialized with ${graphStops.length} stops`);

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: Date.now() })
);

app.use('/api/route', routeRoutes);
app.get('/api/nearby', getNearbyStops);
app.use('/api/search', searchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/stop', stopRoutes);
app.use('/api/bus-lines', busRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint không tồn tại' });
});

app.use((err, req, res, next) => {
  /* eslint-disable no-console */
  console.error('Server error:', err);
  res.status(500).json({ message: 'Đã xảy ra lỗi nội bộ.' });
});

app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Mock transit API running on port ${PORT}`);
});

