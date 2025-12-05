// Script to inspect GTFS data
// Usage: node server/scripts/inspect-gtfs.js

const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/sync').parse;

const GTFS_DIR = path.join(__dirname, '../data/gtfs');

function loadCsv(filename) {
  const filePath = path.join(GTFS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ ${filename} not found`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records;
}

function inspectGtfs() {
  console.log('\n📦 Hanoi Transit - GTFS Inspector\n');
  console.log('📂 GTFS Directory:', GTFS_DIR);
  console.log('─'.repeat(60));

  // Check required files
  const files = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt'];
  const data = {};

  files.forEach(filename => {
    console.log(`\n📄 ${filename}`);
    const records = loadCsv(filename);

    if (!records) {
      return;
    }

    data[filename] = records;
    console.log(`   ✅ ${records.length} records`);

    if (records.length > 0) {
      console.log(`   📋 Columns: ${Object.keys(records[0]).join(', ')}`);
      console.log(`   📝 Sample:`, JSON.stringify(records[0], null, 2));
    }
  });

  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 SUMMARY\n');

  if (data['stops.txt']) {
    const stops = data['stops.txt'];
    console.log(`🚏 Stops: ${stops.length}`);

    const uniqueIds = new Set(stops.map(s => s.stop_id));
    console.log(`   - Unique IDs: ${uniqueIds.size}`);

    const invalidCoords = stops.filter(s =>
      !s.stop_lat || !s.stop_lon ||
      parseFloat(s.stop_lat) === 0 || parseFloat(s.stop_lon) === 0
    );

    if (invalidCoords.length > 0) {
      console.log(`   ⚠️  ${invalidCoords.length} stops with invalid coordinates`);
    }

    // Show sample stops
    console.log(`   📍 First 5 stops:`);
    stops.slice(0, 5).forEach(s => {
      console.log(`      - ${s.stop_id}: ${s.stop_name} (${s.stop_lat}, ${s.stop_lon})`);
    });
  }

  if (data['routes.txt']) {
    const routes = data['routes.txt'];
    console.log(`\n🚌 Routes: ${routes.length}`);

    // Group by route type
    const typeCount = {};
    routes.forEach(r => {
      const type = r.route_type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    console.log(`   - By type:`, typeCount);
    console.log(`   📍 Route list:`);
    routes.forEach(r => {
      console.log(`      - ${r.route_id}: ${r.route_short_name || ''} ${r.route_long_name || ''} (type: ${r.route_type})`);
    });
  }

  if (data['trips.txt']) {
    const trips = data['trips.txt'];
    console.log(`\n🔄 Trips: ${trips.length}`);

    const routeTrips = {};
    trips.forEach(t => {
      routeTrips[t.route_id] = (routeTrips[t.route_id] || 0) + 1;
    });

    console.log(`   - Trips per route:`);
    Object.entries(routeTrips).forEach(([routeId, count]) => {
      console.log(`      - ${routeId}: ${count} trips`);
    });
  }

  if (data['stop_times.txt']) {
    const stopTimes = data['stop_times.txt'];
    console.log(`\n⏰ Stop Times: ${stopTimes.length}`);

    const tripStops = {};
    stopTimes.forEach(st => {
      if (!tripStops[st.trip_id]) tripStops[st.trip_id] = [];
      tripStops[st.trip_id].push(st);
    });

    const avgStopsPerTrip = stopTimes.length / Object.keys(tripStops).length;
    console.log(`   - Average stops per trip: ${avgStopsPerTrip.toFixed(1)}`);

    // Show first trip's stops
    const firstTrip = Object.keys(tripStops)[0];
    if (firstTrip) {
      console.log(`   📍 Sample trip ${firstTrip}:`);
      tripStops[firstTrip]
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
        .slice(0, 5)
        .forEach(st => {
          console.log(`      ${st.stop_sequence}. ${st.stop_id} - ${st.arrival_time}`);
        });
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('✅ Inspection complete!\n');
}

// Run inspection
inspectGtfs();

