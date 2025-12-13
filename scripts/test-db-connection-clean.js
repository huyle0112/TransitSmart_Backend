/**
 * Quick Database Test
 * Test connection and basic queries to verify data exists
 */

const prisma = require('../config/prisma');

async function testConnection() {
    console.log('\n=== Testing Database Connection ===\n');

    try {
        // Test 1: Count records in each table
        console.log('📊 Counting records in tables...');
        const stopsCount = await prisma.stops.count();
        const routesCount = await prisma.routes.count();
        const tripsCount = await prisma.trips.count();
        const stopTimesCount = await prisma.stop_times.count();

        console.log(`✅ Stops: ${stopsCount}`);
        console.log(`✅ Routes: ${routesCount}`);
        console.log(`✅ Trips: ${tripsCount}`);
        console.log(`✅ Stop Times: ${stopTimesCount}\n`);

        if (stopTimesCount === 0) {
            console.log('⚠️  WARNING: stop_times table is empty!');
            console.log('   Please import data first:\n');
            console.log('   1. Create database and tables (db_table)');
            console.log('   2. Import stops.sql');
            console.log('   3. Import routes.sql');
            console.log('   4. Import trips.sql');
            console.log('   5. Import stopTimes.sql\n');
            return;
        }

        // Test 2: Get a sample stop
        console.log('🚏 Getting sample stop...');
        const sampleStop = await prisma.stops.findFirst();
        console.log(`   ID: ${sampleStop.id}`);
        console.log(`   Name: ${sampleStop.name}`);
        console.log(`   Location: ${sampleStop.lat}, ${sampleStop.lng}\n`);

        // Test 3: Get sample route
        console.log('🚌 Getting sample route...');
        const sampleRoute = await prisma.routes.findFirst();
        console.log(`   ID: ${sampleRoute.id}`);
        console.log(`   Name: ${sampleRoute.long_name || sampleRoute.short_name}\n`);

        // Test 3.5: Check stop_times data (CAST TO TEXT to see real times)
        console.log('📅 Checking stop_times data...');
        const sampleStopTimes = await prisma.$queryRaw`
            SELECT st.stop_id, st.departure_time::TEXT as departure_time, st.trip_id
            FROM stop_times st
            ORDER BY st.departure_time
            LIMIT 5;
        `;
        console.log(`   Sample stop_times (first 5 records - REAL TIMES):`);
        sampleStopTimes.forEach((st, index) => {
            console.log(`   ${index + 1}. Stop: ${st.stop_id}, Trip: ${st.trip_id}, Time: ${st.departure_time}`);
        });
        console.log('');

        // Test 4: Test query for SPECIFIC STOP (like real use case)
        console.log('⏰ Testing upcoming buses for a SPECIFIC STOP...');
        const currentTime = new Date();
        const hours = String(currentTime.getHours()).padStart(2, '0');
        const minutes = String(currentTime.getMinutes()).padStart(2, '0');
        const seconds = String(currentTime.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        // Test with sample stop (the first stop from sample data)
        const testStopId = sampleStop.id;
        console.log(`   Testing with stop: ${testStopId} (${sampleStop.name})`);
        console.log(`   Current time: ${timeString}`);

        // Query for THIS SPECIFIC STOP only
        let upcomingTrips = await prisma.$queryRaw`
            SELECT 
                st.stop_id,
                st.departure_time::TEXT as departure_time,
                st.trip_id,
                r.id as route_id,
                r.short_name,
                r.long_name
            FROM stop_times st
            JOIN trips t ON st.trip_id = t.trip_id
            JOIN routes r ON t.route_id = r.id
            WHERE st.stop_id = ${testStopId}
              AND st.departure_time >= CAST(${timeString} AS TIME)
            ORDER BY st.departure_time ASC
            LIMIT 10;
        `;

        console.log(`   Found ${upcomingTrips.length} upcoming buses at this stop (REAL TIMES):\n`);

        if (upcomingTrips.length > 0) {
            upcomingTrips.forEach((trip, index) => {
                console.log(`   ${index + 1}. Route ${trip.short_name} - Trip: ${trip.trip_id} - Departs: ${trip.departure_time}`);
            });
        }

        if (upcomingTrips.length === 0) {
            console.log('\n⚠️  No upcoming buses found at current time for this stop.');
            console.log('   💡 Trying with early morning time (06:00:00)...\n');

            // Try with 6:00 AM for THIS SPECIFIC STOP
            upcomingTrips = await prisma.$queryRaw`
                SELECT 
                    st.stop_id,
                    st.departure_time::TEXT as departure_time,
                    st.trip_id,
                    r.id as route_id,
                    r.short_name,
                    r.long_name
                FROM stop_times st
                JOIN trips t ON st.trip_id = t.trip_id
                JOIN routes r ON t.route_id = r.id
                WHERE st.stop_id = ${testStopId}
                  AND st.departure_time >= CAST(${ '06:00:00' } AS TIME)
                ORDER BY st.departure_time ASC
                LIMIT 10;
            `;

            console.log(`   Found ${upcomingTrips.length} buses starting from 06:00:00 (REAL TIMES):\n`);
            upcomingTrips.forEach((trip, index) => {
                console.log(`   ${index + 1}. Route ${trip.short_name} - Trip: ${trip.trip_id} - Departs: ${trip.departure_time}`);
            });
        }

        // Test 5: Group by route to show "next 3 buses per route"
        if (upcomingTrips.length > 0) {
            console.log('\n📋 Grouping by route (like real API response):\n');

            const routeMap = new Map();
            upcomingTrips.forEach(trip => {
                if (!routeMap.has(trip.route_id)) {
                    routeMap.set(trip.route_id, {
                        routeId: trip.route_id,
                        routeName: trip.short_name || trip.long_name,
                        nextBuses: []
                    });
                }

                const route = routeMap.get(trip.route_id);
                if (route.nextBuses.length < 3) {
                    const [h, m] = trip.departure_time.split(':').map(Number);
                    const depMin = h * 60 + m;
                    const curMin = currentTime.getHours() * 60 + currentTime.getMinutes();
                    const minutesUntil = depMin - curMin;

                    route.nextBuses.push({
                        time: trip.departure_time,
                        minutesUntil: minutesUntil > 0 ? minutesUntil : minutesUntil + 1440
                    });
                }
            });

            routeMap.forEach((route, index) => {
                console.log(`   Route ${route.routeName}:`);
                route.nextBuses.forEach((bus, idx) => {
                    console.log(`      ${idx + 1}. In ${bus.minutesUntil} minutes (${bus.time})`);
                });
                console.log('');
            });
        }

        if (upcomingTrips.length === 0) {
            console.log('\n❌ No trips found in database!');
            console.log('   Check if stopTimes.sql was imported correctly.\n');
        } else {
            console.log('\n✅ Database is working correctly!');
            console.log('   You can now use the API endpoints.\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\n💡 Make sure:');
        console.error('   1. PostgreSQL is running');
        console.error('   2. DATABASE_URL in .env is correct');
        console.error('   3. Database tables are created');
        console.error('   4. Data is imported\n');
    } finally {
        await prisma.$disconnect();
    }
}

// Run test
testConnection();
