# Admin Bus Routes API Documentation

Base URL: `/api/bus-lines`

## 1. Create Bus Route
Create a new bus route.

**Endpoint:** `POST /`

**Body Parameters (JSON):**
- `id` (string, required): Unique identifier for the route (e.g., "01_1").
- `short_name` (string): Short name or code (e.g., "01").
- `long_name` (string, required): Full name of the route (e.g., "Tuyến 01").
- `type` (string): Type of vehicle, defaults to "bus".
- `fare` (integer): Ticket price.
- `forward_direction` (boolean): `true` for forward direction, `false` for return.

**Example Request:**
```json
{
  "id": "new_route_01",
  "short_name": "NR01",
  "long_name": "New Route 01",
  "type": "bus",
  "fare": 7000,
  "forward_direction": true
}
```

**Response:** (201 Created) returns created route object.

---

## 2. Update Bus Route
Update an existing bus route.

**Endpoint:** `PUT /:id`

**Path Parameters:**
- `id`: The ID of the route to update.

**Body Parameters (JSON):**
Any of the fields from Create (except `id` is usually constant).

**Example Request:**
```json
{
  "fare": 8000,
  "long_name": "Updated Route Name"
}
```

**Response:** (200 OK) returns updated route object.

---

## 3. Delete Bus Route
Delete a bus route. This will also delete all associated trips if configured.

**Endpoint:** `DELETE /:id`

**Path Parameters:**
- `id`: The ID of the route to delete.

**Response:** (200 OK)
```json
{
  "message": "Xoá tuyến buýt thành công."
}
```
