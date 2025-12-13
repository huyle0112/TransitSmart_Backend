/**
 * Test: Tìm xe buýt đi qua bến có tọa độ cụ thể
 * Query tọa độ từ stop_id (không hardcode tọa độ)
 */

const prisma = require('../config/prisma');

async function testBusesAtSpecificLocation() {
    // Thay đổi stop_id này để test với bến khác
    const targetStopId = '01_1_S27';  // Stop ID để lấy tọa độ
    const testTime = '06:00:00';

    console.log(`\n=== TEST: Xe buýt sắp đến tại bến ${targetStopId} ===\n`);

    try {
        // Step 1: Lấy tọa độ của stop_id cần test
        console.log(`📍 Lấy tọa độ của bến ${targetStopId}...\n`);

        const targetStop = await prisma.$queryRaw`
            SELECT id, name, lat, lng
            FROM stops
            WHERE id = ${targetStopId};
        `;

        if (targetStop.length === 0) {
            console.log(`❌ Không tìm thấy bến với ID: ${targetStopId}\n`);
            return;
        }

        const baseStop = targetStop[0];
        console.log(`✅ Tìm thấy bến:`);
        console.log(`   ID: ${baseStop.id}`);
        console.log(`   Tên: ${baseStop.name}`);
        console.log(`   Tọa độ: ${baseStop.lat}, ${baseStop.lng}\n`);

        // Step 2: Tìm TẤT CẢ các stop_id có CÙNG TỌA ĐỘ với bến này
        // (Giống như trong query SQL: WHERE (lat, lng) = (SELECT lat, lng FROM stops WHERE id = '09_1_S27'))
        console.log('🔍 Tìm tất cả stop_id có cùng tọa độ với bến này...\n');

        const stopsAtSameLocation = await prisma.$queryRaw`
            SELECT id, name, lat, lng
            FROM stops
            WHERE (lat, lng) = (
                SELECT lat, lng 
                FROM stops 
                WHERE id = ${targetStopId}
            );
        `;

        console.log(`   Tìm thấy ${stopsAtSameLocation.length} stop(s) tại cùng tọa độ:`);
        stopsAtSameLocation.forEach((stop, idx) => {
            console.log(`      ${idx + 1}. ${stop.id} - ${stop.name}`);
        });
        console.log('');

        // Step 3: Tìm xe buýt đi qua BẤT KỲ stop_id nào có cùng tọa độ
        // Query giống y hệt như ví dụ của bạn
        console.log(`⏰ Tìm xe buýt đi qua các stop tại vị trí này sau ${testTime}...\n`);

        const upcomingBuses = await prisma.$queryRaw`
            SELECT 
                s.name AS stop_name,
                r.short_name AS route_short_name,
                r.long_name AS route_long_name,
                r.type AS route_type,
                st.departure_time::TEXT as departure_time,
                t.trip_id,
                st.stop_id,
                st.stop_sequence,
                r.id as route_id,
                r.fare
            FROM stop_times AS st
            JOIN trips AS t ON st.trip_id = t.trip_id
            JOIN routes AS r ON t.route_id = r.id
            JOIN stops AS s ON st.stop_id = s.id
            WHERE st.stop_id IN (
                SELECT id
                FROM stops
                WHERE (lat, lng) = (
                    SELECT lat, lng 
                    FROM stops 
                    WHERE id = ${targetStopId}
                )
            )
              AND st.departure_time >= CAST(${testTime} AS TIME)
            ORDER BY st.departure_time
            LIMIT 30;
        `;

        console.log(`🚌 Tìm thấy ${upcomingBuses.length} chuyến xe sau ${testTime}:\n`);

        if (upcomingBuses.length === 0) {
            console.log('❌ Không có chuyến xe nào sau thời điểm này!\n');
            return;
        }

        // Step 4: Hiển thị danh sách xe
        console.log('📋 Danh sách các chuyến xe:\n');
        upcomingBuses.slice(0, 15).forEach((bus, index) => {
            console.log(`   ${index + 1}. Tuyến ${bus.route_short_name} - ${bus.route_long_name || 'N/A'}`);
            console.log(`      Loại: ${bus.route_type}`);
            console.log(`      Stop: ${bus.stop_name} (${bus.stop_id})`);
            console.log(`      Trip ID: ${bus.trip_id}`);
            console.log(`      Khởi hành: ${bus.departure_time}`);
            console.log(`      Giá vé: ${bus.fare ? bus.fare.toLocaleString() + ' VNĐ' : 'N/A'}`);
            console.log('');
        });

        // Step 5: Group theo tuyến (3 chuyến đầu tiên của mỗi tuyến)
        console.log('\n🎯 Nhóm theo tuyến (3 chuyến gần nhất/tuyến):\n');

        const routeMap = new Map();
        upcomingBuses.forEach(bus => {
            const routeKey = bus.route_id;

            if (!routeMap.has(routeKey)) {
                routeMap.set(routeKey, {
                    routeId: bus.route_id,
                    routeName: bus.route_short_name,
                    longName: bus.route_long_name,
                    fare: bus.fare,
                    departures: []
                });
            }

            const route = routeMap.get(routeKey);
            if (route.departures.length < 3) {
                route.departures.push({
                    time: bus.departure_time,
                    tripId: bus.trip_id
                });
            }
        });

        let routeIndex = 1;
        routeMap.forEach((route) => {
            console.log(`   ${routeIndex}. Tuyến ${route.routeName} ${route.longName ? '- ' + route.longName : ''}`);
            console.log(`      Giá vé: ${route.fare ? route.fare.toLocaleString() + ' VNĐ' : 'N/A'}`);
            console.log(`      Các chuyến xe sắp đến:`);

            route.departures.forEach((dep, idx) => {
                console.log(`         ${idx + 1}. ${dep.time} (${dep.tripId})`);
            });

            console.log('');
            routeIndex++;
        });

        // Step 6: Tính thời gian còn lại (giả sử hiện tại là 06:00:00)
        console.log('\n⏱️  Thời gian còn lại (từ 06:00:00):\n');

        const currentTimeMin = 6 * 60; // 06:00 = 360 minutes
        const topBuses = upcomingBuses.slice(0, 5);

        topBuses.forEach((bus, index) => {
            const [h, m] = bus.departure_time.split(':').map(Number);
            const depMin = h * 60 + m;
            const minutesUntil = depMin - currentTimeMin;

            console.log(`   ${index + 1}. Tuyến ${bus.route_short_name} - Còn ${minutesUntil} phút (khởi hành lúc ${bus.departure_time})`);
        });

        console.log('\n✅ Test hoàn tất!\n');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

// Run test
testBusesAtSpecificLocation();
