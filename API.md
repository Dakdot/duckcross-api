Based on the multi-agency transit database structure, here are some useful API routes I'd recommend creating:

## Core Transit Information APIs

### 1. **Stops & Stations**

```javascript
// Get all stops for an agency
GET /api/agencies/:agencyId/stops

// Get stop details with all serving agencies
GET /api/stops/:stopId

// Find stops near coordinates (with optional agency filter)
GET /api/stops/nearby?lat=40.7505&lng=-73.9935&radius=500&agencies=mta,njt

// Get multi-agency transfer stations
GET /api/stops/transfers

// Search stops by name
GET /api/stops/search?q=penn%20station&agencies=mta
```

### 2. **Routes & Services**

```javascript
// Get all routes for an agency
GET /api/agencies/:agencyId/routes

// Get route details with patterns
GET /api/routes/:routeId

// Get all routes serving a specific stop
GET /api/stops/:stopId/routes

// Find routes between two stops
GET /api/routes/between?from=stopId1&to=stopId2
```

### 3. **Real-time & Schedules**

```javascript
// Get upcoming departures for a stop (all agencies)
GET /api/stops/:stopId/departures?limit=10

// Get departures for specific agency at a stop
GET /api/stops/:stopId/departures?agency=mta

// Get schedule for a specific trip
GET /api/trips/:tripId/schedule

// Get next trips for a route pattern
GET /api/patterns/:patternId/trips?from=now&limit=5
```

## Journey Planning APIs

### 4. **Trip Planning**

```javascript
// Plan journey between two points (cross-agency)
POST /api/journey/plan
{
  "from": {"lat": 40.7505, "lng": -73.9935},
  "to": {"lat": 40.6782, "lng": -73.9442},
  "time": "2025-06-04T14:30:00Z",
  "preferences": {
    "agencies": ["mta", "njt"],
    "maxWalking": 800,
    "accessible": true
  }
}

// Get transfer options between agencies at a station
GET /api/stops/:stopId/transfers
```

### 5. **Service Status**

```javascript
// Get service alerts for an agency
GET /api/agencies/:agencyId/alerts

// Get alerts affecting a specific stop
GET /api/stops/:stopId/alerts

// Get system-wide status
GET /api/status/system

// Service calendar for date range
GET /api/service/calendar?start=2025-06-04&end=2025-06-10&agencies=mta
```

## Analytics & Reporting APIs

### 6. **System Analytics**

```javascript
// Get agency coverage statistics
GET /api/analytics/coverage

// Stop utilization metrics
GET /api/analytics/stops/utilization?timeframe=week

// Multi-agency station statistics
GET /api/analytics/transfers/volume

// Route performance metrics
GET /api/analytics/routes/:routeId/performance
```

## Administrative APIs

### 7. **Data Management**

```javascript
// Import new GTFS data
POST /api/admin/import/gtfs
{
  "agencyId": "mta",
  "gtfsUrl": "https://example.com/gtfs.zip",
  "replaceExisting": false
}

// Merge duplicate stops
POST /api/admin/stops/merge
{
  "primaryStopId": "stop123",
  "duplicateStopIds": ["stop456", "stop789"]
}

// Validate data integrity
GET /api/admin/validate/stops
GET /api/admin/validate/routes
```

## Specialized Multi-Agency APIs

### 8. **Cross-System Features**

```javascript
// Find all agencies serving a geographic area
GET /api/agencies/coverage?bounds=40.7,-74.0,40.8,-73.9

// Get cross-agency fare information
GET /api/fares/cross-agency?from=stopId1&to=stopId2

// Find optimal transfer points between agencies
GET /api/transfers/optimal?fromAgency=mta&toAgency=njt&area=manhattan

// Get unified departures board for multi-agency stations
GET /api/stops/:stopId/departures/unified
```

## Example API Response Structures

### Stop with Multiple Agencies

```json
{
  "id": "stop_123",
  "name": "New York Penn Station",
  "location": {
    "latitude": 40.750568,
    "longitude": -73.993519
  },
  "agencies": [
    {
      "agency": {
        "id": "mta",
        "name": "Metropolitan Transportation Authority"
      },
      "agencyStopCode": "NYP",
      "zoneId": "1"
    },
    {
      "agency": {
        "id": "njt",
        "name": "NJ Transit"
      },
      "agencyStopCode": "NYP",
      "zoneId": "A"
    }
  ],
  "accessibility": "ACCESSIBLE",
  "parentStation": null
}
```

### Cross-Agency Journey Plan

```json
{
  "journeys": [
    {
      "duration": 3600,
      "walkingDistance": 400,
      "legs": [
        {
          "mode": "WALK",
          "from": { "lat": 40.7505, "lng": -73.9935 },
          "to": {
            "stopId": "stop_123",
            "name": "Penn Station"
          },
          "duration": 300
        },
        {
          "mode": "RAIL",
          "agency": "NJ Transit",
          "route": "Northeast Corridor",
          "from": "Penn Station NY",
          "to": "Newark Penn",
          "departure": "2025-06-04T14:45:00Z",
          "arrival": "2025-06-04T15:15:00Z"
        }
      ],
      "transfers": 0,
      "agencies": ["njt"]
    }
  ]
}
```

These APIs would provide comprehensive coverage for:

- Multi-agency transit apps
- Journey planning across systems
- Real-time information displays
- Analytics dashboards
- Administrative tools for transit agencies
- Third-party integrations

The key advantage is that these APIs naturally handle the complexity of multi-agency systems while providing clean, unified interfaces for developers.
