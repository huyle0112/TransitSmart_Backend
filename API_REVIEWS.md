# Review API Documentation

Base URL: `/api/reviews`

This endpoint allows authenticated users to create or update reviews for specific targets (e.g., bus routes/lines).

## 1. Get Reviews for a Route

**Endpoint**: `GET /api/reviews`

**Query Parameters**:
-   `targetType`: Must be `'route'` (for bus lines) or `'stop'`.
-   `targetId`: The ID of the route or stop (e.g., `'01'`, `'02'`).

**Example Request**:
```http
GET /api/reviews?targetType=route&targetId=01
```

**Response**:
```json
{
  "targetType": "route",
  "targetId": "01",
  "averageRating": 4.5,
  "totalReviews": 10,
  "reviews": [
    {
      "id": "uuid-string",
      "rating": 5,
      "comment": "Good service",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "user": {
        "id": "user-uuid",
        "name": "John Doe"
      }
    }
  ]
}
```

---

## 2. Submit (Create/Update) a Review

**Endpoint**: `POST /api/reviews`

**Headers**:
-   `Authorization`: `Bearer <your_jwt_token>`
-   `Content-Type`: `application/json`

**Body**:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `targetType` | String | Yes | Must be `'route'` or `'stop'`. |
| `targetId` | String | Yes | ID of the route being reviewed. |
| `rating` | Number | Yes | Integer from 1 to 5. |
| `comment` | String | No | Text review content. |

**Example Request**:
```json
{
  "targetType": "route",
  "targetId": "01",
  "rating": 5,
  "comment": "Great experience, on time!"
}
```

**Response (201 Created)**:
```json
{
  "review": {
    "id": "new-uuid",
    "rating": 5,
    "comment": "Great experience, on time!",
    "targetType": "route",
    "targetId": "01",
    "createdAt": "...",
    "user": { ... }
  },
  "summary": {
    "averageRating": 4.6,
    "totalReviews": 11
  }
}
```

## 3. Delete a Review

**Endpoint**: `DELETE /api/reviews/:id`

**Headers**:
-   `Authorization`: `Bearer <your_jwt_token>`

**Response**:
-   `204 No Content`: Successful deletion.
-   `403 Forbidden`: If trying to delete someone else's review (unless admin).
