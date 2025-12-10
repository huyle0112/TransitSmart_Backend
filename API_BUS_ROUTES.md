# Bus Routes API Documentation

Base URL: `/api/bus-lines`

## 1. Search Bus Routes
Search for bus routes by name or number.

**Endpoint:** `GET /search`

**Query Parameters:**
- `q` (required): The search keyword (e.g., "01", "Ben Thanh").

**Response:** Array of unique bus routes found.

```json
[
  {
    "name": "Tuyến 01",
    "description": "n/a-01_1",
    "sampleId": "01_1"
  },
  {
    "name": "Tuyến 02",
    "description": "n/a-02_1",
    "sampleId": "02_1"
  }
]
```

## 2. Get Bus Line Details
Get detailed information about a specific bus line, including its stops in both directions (forward and backward).

**Endpoint:** `GET /details`

**Query Parameters:**
- `name` (required): The exact name of the route (e.g., "Tuyến 01").

**Response:** Object containing route name and directions.

```json
{
  "name": "Tuyến 01",
  "directions": [
    {
      "route_id": "01_1",
      "direction": "forward",
      "headsign": "n/a-01_1",
      "stops": [
        {
          "id": "stop_id_1",
          "name": "Ben Thanh",
          "lat": 10.77,
          "lng": 106.70,
          "type": "bus"
        },
        ...
      ]
    },
    {
      "route_id": "01_2",
      "direction": "backward",
      "headsign": "n/a-01_2",
      "stops": [ ... ]
    }
  ]
}
```

## 3. Get Route Schedule
Get the schedule (list of trips) for a specific route direction.

**Endpoint:** `GET /schedule`

**Query Parameters:**
- `routeId` (required): The specific route ID (e.g., "01_1"). You can get this from the `details` endpoint.

**Response:** Array of trips sorted by start time.

```json
[
  {
    "trip_id": "01_1_AM_1",
    "start_time": "1970-01-01T05:00:00.000Z",
    "end_time": "1970-01-01T06:30:00.000Z"
  },
  {
    "trip_id": "01_1_AM_2",
    "start_time": "1970-01-01T05:15:00.000Z",
    "end_time": "1970-01-01T06:45:00.000Z"
  }
]
```
