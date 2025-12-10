 
**Hướng dẫn tạo database**

CƠ SƠ DỮ LIỆU SỬ DỤNG: POSTGRESQL
tạo file .env, thêm DATABASE_URL vào

chạy lệnh:

```bash
npm install
npx prisma generate
```

```bash
npx prisma migrate dev --name init
```
(Hoặc có thể chạy file /db_migration/db_table thủ công :vv)

Sau đó import thủ công dữ liệu từ ./db_migration/db_data


**Tạo 1 model mới**
ví dụ tạo model vehicle: thêm vào file prisma/schema.prisma:
```prisma
model vehicles {
  id    String  @id @default(uuid())
  name  String
  type  String
  speed Int?
}
```
Chạy migration:
```bash
npx prisma migrate dev --name create_vehicles_table
```
Tiếp theo tạo các endpoint theo hướng dẫn.


**HƯỚNG DẪN TẠO MỘT ENDPOINT MỚI TRONG EXPRESS + PRISMA (CLEAN ARCHITECTURE)**

*Version: 1.0 – Sử dụng Prisma, Services, Controllers, Routes*

---

 **TỔNG QUAN KIẾN TRÚC**

Mỗi endpoint phải đi qua 4 tầng:

```
Request → Router → Controller → Service → Repository → Prisma → DB
```

 **BƯỚC 1 — Tạo Repository (Làm việc với Prisma)**

 `src/repositories/<entity>.repo.js`

Repository chỉ chứa **query** tới DB bằng Prisma.
Ví dụ: tạo repo cho `stops`.

```js
const prisma = require("../prisma/client");

module.exports = {
  getAll: () => prisma.stops.findMany(),

  getById: (id) =>
    prisma.stops.findUnique({ where: { id } }),

  create: (data) =>
    prisma.stops.create({ data })
};
```

> Quy tắc:
> Không viết logic xử lý dữ liệu ở đây
> Chỉ Prisma + query

---

**BƯỚC 2 — Tạo Service (Nơi xử lý logic nghiệp vụ)**

`src/services/<entity>.service.js`

Service dùng repository, thực hiện logic như validate, convert, kiểm tra tồn tại,…

```js
const stopsRepo = require("../repositories/stops.repo");

module.exports = {
  getAllStops() {
    return stopsRepo.getAll();
  },

  getStopById(id) {
    return stopsRepo.getById(id);
  },

  createStop(data) {
    return stopsRepo.create(data);
  }
};
```

> Quy tắc:
> Không dùng `req`, `res` trong service
> Không trả HTTP status
> Chỉ trả kết quả hoặc throw lỗi

---

 **BƯỚC 3 — Tạo Controller (Làm việc với Express)**

`src/controllers/<entity>.controller.js`

Controller nhận request, gọi service, trả JSON.

```js
const stopsService = require("../services/stops.service");

module.exports = {
  async getAllStops(req, res) {
    try {
      const result = await stopsService.getAllStops();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async createStop(req, res) {
    try {
      const result = await stopsService.createStop(req.body);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
```

> Quy tắc:
> Controller rất mỏng
> Không chứa logic nghiệp vụ
> Chỉ xử lý req → res

---

 **BƯỚC 4 — Tạo Router (Điểm entry của endpoint)**

`src/routes/<entity>.routes.js`

```js
const express = require("express");
const router = express.Router();
const stopsController = require("../controllers/stops.controller");

router.get("/", stopsController.getAllStops);
router.post("/", stopsController.createStop);
router.get("/:id", stopsController.getStopById);

module.exports = router;
```

> Quy tắc:
> Không chứa logic
> Chỉ map URL → controller method

---

**BƯỚC 5 — Gắn Router vào Express**

`src/app.js` hoặc `server.js`

```js
const express = require("express");
const app = express();

const stopsRouter = require("./routes/stops.routes");

app.use(express.json());

app.use("/stops", stopsRouter);

app.listen(3000, () => console.log("Server running on port 3000"));
```

---

Ngoài ra khi muốn định nghĩa các hàm tiện ích mới, viết vào module **utils**.
