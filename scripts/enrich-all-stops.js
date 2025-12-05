// Script to enrich ALL 6480 stops with proper "Bến + địa danh" naming
// Usage: node server/scripts/enrich-all-stops.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const parse = require('csv-parse/sync').parse;
const stringify = require('csv-stringify/sync').stringify;

const GTFS_DIR = path.join(__dirname, '../data/gtfs');
const STOPS_INPUT = path.join(GTFS_DIR, 'stops.txt');
const STOPS_OUTPUT = path.join(GTFS_DIR, 'stops-enriched.txt');
const CACHE_FILE = path.join(GTFS_DIR, 'geocode-cache.json');

// Rate limiting
const DELAY_MS = 500; // 500ms between requests
let requestCount = 0;

// Load cache
let geocodeCache = {};
if (fs.existsSync(CACHE_FILE)) {
  geocodeCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  console.log(`📦 Loaded ${Object.keys(geocodeCache).length} cached results`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reverse geocode with Vietnamese language priority
 */
async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat},${lon}`;

  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }

  if (requestCount > 0) {
    await sleep(DELAY_MS);
  }

  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi,en`;

    const options = {
      headers: {
        'User-Agent': 'HanoiTransit/1.0 (Educational Project)'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        requestCount++;

        try {
          const result = JSON.parse(data);

          if (result.error) {
            console.warn(`⚠️  Geocoding error: ${result.error}`);
            resolve(null);
            return;
          }

          const addr = result.address || {};
          let locationName = '';

          // Priority 1: Road with house number (e.g., "81 Nguyễn Trãi")
          if (addr.house_number && addr.road) {
            locationName = `${addr.house_number} ${addr.road}`;
          }
          // Priority 2: Road name only
          else if (addr.road) {
            locationName = addr.road;
          }
          // Priority 3: Notable landmarks
          else if (addr.amenity) {
            locationName = addr.amenity;
          }
          else if (addr.building) {
            locationName = addr.building;
          }
          else if (addr.tourism) {
            locationName = addr.tourism;
          }
          // Priority 4: Area names
          else if (addr.suburb) {
            locationName = addr.suburb;
          }
          else if (addr.neighbourhood) {
            locationName = addr.neighbourhood;
          }
          else if (addr.quarter) {
            locationName = addr.quarter;
          }
          else if (addr.hamlet) {
            locationName = addr.hamlet;
          }
          else {
            locationName = result.display_name?.split(',')[0] || 'Unknown';
          }

          // Clean up
          locationName = locationName.trim();

          // Cache result
          geocodeCache[cacheKey] = locationName;

          resolve(locationName);
        } catch (err) {
          console.error(`❌ Parse error:`, err.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Request error:`, err.message);
      resolve(null);
    });
  });
}

/**
 * Calculate distance between two points
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Group stops by location (within ~50m)
 */
function groupStopsByLocation(stops, thresholdKm = 0.05) {
  const groups = [];
  const processed = new Set();

  stops.forEach((stop, i) => {
    if (processed.has(i)) return;

    const group = [stop];
    processed.add(i);

    const lat1 = parseFloat(stop.stop_lat);
    const lon1 = parseFloat(stop.stop_lon);

    stops.forEach((other, j) => {
      if (i === j || processed.has(j)) return;

      const lat2 = parseFloat(other.stop_lat);
      const lon2 = parseFloat(other.stop_lon);

      const distance = haversineDistance(lat1, lon1, lat2, lon2);

      if (distance <= thresholdKm) {
        group.push(other);
        processed.add(j);
      }
    });

    groups.push(group);
  });

  return groups;
}

/**
 * Save cache to disk
 */
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
}

/**
 * Main enrichment function
 */
async function enrichAllStops() {
  console.log('\n' + '='.repeat(70));
  console.log('  🚏 Enrich ALL 6480 Stops - Format: "Bến + Địa danh"');
  console.log('='.repeat(70) + '\n');

  // Load stops
  const stopsContent = fs.readFileSync(STOPS_INPUT, 'utf8');
  const stops = parse(stopsContent, { columns: true, skip_empty_lines: true });

  console.log(`📍 Loaded ${stops.length} stops\n`);

  // Group by location
  console.log('🔍 Grouping stops by location...');
  const groups = groupStopsByLocation(stops);
  console.log(`   Found ${groups.length} unique locations\n`);

  // Find unenriched groups (only process STOP_ names)
  const unenriched = groups.filter(group => 
    group[0].stop_name.startsWith('STOP_')
  );

  console.log('📊 Status:');
  console.log(`   - Already enriched: ${groups.length - unenriched.length} locations`);
  console.log(`   - Need enrichment: ${unenriched.length} locations\n`);

  if (unenriched.length === 0) {
    console.log('✅ All stops already enriched!');
    return;
  }

  // Process all unenriched groups
  console.log(`🌍 Starting enrichment of ${unenriched.length} locations...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < unenriched.length; i++) {
    const group = unenriched[i];
    const firstStop = group[0];
    const lat = parseFloat(firstStop.stop_lat);
    const lon = parseFloat(firstStop.stop_lon);

    const progress = `[${i + 1}/${unenriched.length}]`;
    process.stdout.write(`   ${progress} ${firstStop.stop_id} ... `);

    const placeName = await reverseGeocode(lat, lon);

    if (placeName) {
      // Format as "Bến [địa danh]"
      const newName = `Bến ${placeName}`;

      // Update all stops in this group
      group.forEach(stop => {
        stop.stop_name = newName;
      });

      console.log(`✅ ${newName}`);
      successCount++;
    } else {
      console.log(`❌ Failed`);
      failCount++;
    }

    // Save cache every 50 requests
    if ((i + 1) % 50 === 0) {
      saveCache();
      console.log(`   💾 Saved cache (${Object.keys(geocodeCache).length} entries)\n`);
    }
  }

  // Save final cache
  saveCache();
  console.log(`\n💾 Saved final cache (${Object.keys(geocodeCache).length} entries)`);

  // Write enriched stops
  const csv = stringify(stops, { header: true, columns: Object.keys(stops[0]) });
  fs.writeFileSync(STOPS_OUTPUT, csv);

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Enrichment Complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Total stops: ${stops.length}`);
  console.log(`   - Unique locations: ${groups.length}`);
  console.log(`   - Processed: ${unenriched.length}`);
  console.log(`   - Success: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - API requests: ${requestCount}`);
  console.log(`\n📁 Output: ${STOPS_OUTPUT}`);
  console.log('\n🎉 Next steps:');
  console.log('   1. Review stops-enriched.txt');
  console.log('   2. Copy stops-enriched.txt to stops.txt');
  console.log('   3. Restart server to see enriched names\n');
}

// Run
enrichAllStops().catch(err => {
  console.error('\n❌ Error:', err);
  saveCache();
  process.exit(1);
});

