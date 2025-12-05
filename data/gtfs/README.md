# GTFS Setup README

Thư mục này chứa dữ liệu GTFS (General Transit Feed Specification) cho hệ thống xe buýt Hà Nội.

## 📁 Cấu trúc thư mục

```
server/data/gtfs/
  ├── stops.txt          # Danh sách các điểm dừng xe
  ├── routes.txt         # Danh sách các tuyến xe
  ├── trips.txt          # Các chuyến xe trong mỗi tuyến
  ├── stop_times.txt     # Thời gian dừng tại mỗi điểm
  └── calendar.txt       # Lịch hoạt động
```

## 🚀 Cách sử dụng

### Bước 1: Copy file GTFS vào thư mục này

Copy các file `.txt` từ GTFS data của Hà Nội vào thư mục `server/data/gtfs/`:

```bash
# Ví dụ: Copy từ thư mục gtfs-hanoi-midday
copy gtfs-hanoi-midday\*.txt server\data\gtfs\
```

Hoặc copy từ thư mục AM:
```bash
copy gtfs-hanoi-am\*.txt server\data\gtfs\
```

### Bước 2: Kiểm tra dữ liệu GTFS

Chạy script inspect để xem thống kê:

```bash
cd server
node scripts/inspect-gtfs.js
```

Script này sẽ hiển thị:
- Số lượng stops, routes, trips
- Sample data từ mỗi file
- Các vấn đề tiềm ẩn (duplicate IDs, invalid coordinates)

### Bước 3: Khởi động server

Server sẽ tự động load dữ liệu từ GTFS khi khởi động:

```bash
cd server
npm start
```

## 📊 Format dữ liệu

### stops.txt
```csv
stop_id,stop_name,stop_lat,stop_lon,stop_code
S001,Bến Xe Giáp Bát,20.9876,105.8342,GB001
```

### routes.txt
```csv
route_id,route_short_name,route_long_name,route_type,route_color
R01,01,Kim Mã - Bến Xe Giáp Bát,3,1f8eed
```

### trips.txt
```csv
route_id,service_id,trip_id,trip_headsign,direction_id
R01,weekday,T01_01,Giáp Bát,0
```

### stop_times.txt
```csv
trip_id,arrival_time,departure_time,stop_id,stop_sequence
T01_01,05:00:00,05:00:00,S001,1
T01_01,05:10:00,05:10:00,S002,2
```

## 🔄 Hot reload

Để reload lại GTFS data mà không cần restart server, gọi API:

```bash
curl -X POST http://localhost:5000/api/admin/reload-gtfs
```

(Cần implement endpoint này nếu muốn dùng)

## ⚙️ Cấu hình

File `server/utils/gtfsLoader.js` có các tham số có thể điều chỉnh:

- `WALK_THRESHOLD_KM`: Khoảng cách tối đa để đi bộ giữa 2 điểm dừng (mặc định: 0.5km)
- Speed estimates: Tốc độ xe bus (20 km/h), tàu (40 km/h)
- Default fare: Giá vé mặc định (7000 VND)

## 🐛 Xử lý lỗi

### Lỗi: "GTFS file not found"
- Đảm bảo các file .txt đã được copy vào `server/data/gtfs/`
- Kiểm tra tên file phải chính xác (stops.txt, không phải Stops.txt)

### Lỗi: "Invalid coordinates"
- Một số stop có lat/lon = 0 hoặc null
- Cần sửa trực tiếp trong file stops.txt

### Lỗi: "No routes found"
- Kiểm tra routes.txt và trips.txt có dữ liệu
- Đảm bảo stop_times.txt có đầy đủ stop_sequence

## 📚 Tham khảo

- GTFS Specification: https://gtfs.org/
- GTFS Validator: https://gtfs-validator.mobilitydata.org/

