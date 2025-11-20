# Dexatronix (DexoryView) Integration Guide

## 🤖 Overview

SmartPick AI now integrates with Dexatronix (DexoryView) robots to automatically sync real-time warehouse scan data, providing:

- **Real-time inventory visibility** from robot scans
- **Automatic data conversion** from Dexatronix to SmartPick format
- **Bi-directional sync** - pull scan data, push WMS updates
- **Webhook support** for instant scan result notifications
- **Image access** to warehouse location photos

## 📋 Prerequisites

1. **Dexatronix Account**: Active customer account with DexoryView
2. **API Credentials**:
   - API Key (from Dexatronix dashboard)
   - Customer slug (e.g., `planet-express`, `maersk`)
   - Site slug (e.g., `atlanta`, `new-new-york`)
3. **Network Access**: Ability to reach `https://api.service.dexoryview.com`

## 🔧 Configuration

### Step 1: Set Environment Variables

Create or edit `.env` file in backend directory:

```bash
# Dexatronix API Configuration
DEXATRONIX_API_KEY=your-api-key-from-dexoryview-dashboard
DEXATRONIX_CUSTOMER=your-customer-slug
DEXATRONIX_SITE=your-site-slug
DEXATRONIX_API_VERSION=v2
```

### Step 2: Verify Configuration

Test your connection:

```bash
curl http://localhost:4010/api/v1/dexatronix/test
```

Expected response:
```json
{
  "success": true,
  "message": "Connection successful",
  "sample_location": {
    "name": "A1-01",
    "aisle": "A",
    "status": "occupied_with_exact_match"
  }
}
```

## 🚀 API Endpoints

### 1. Test Connection
**GET** `/api/v1/dexatronix/test`

Validates API credentials and connectivity.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "sample_location": { },
  "timestamp": "2025-11-18T12:00:00Z"
}
```

---

### 2. Fetch Locations
**GET** `/api/v1/dexatronix/locations`

Retrieve warehouse locations with scan data from Dexatronix.

**Query Parameters:**
- `aisles` (string or array): Filter by aisle(s), e.g., `?aisles=A1&aisles=A2`
- `page` (integer): Page number (default: 1)
- `pageSize` (integer): Items per page (default: 100, max: 1000)
- `upTo` (string): Return data up to this date (ISO format)

**Example:**
```bash
curl "http://localhost:4010/api/v1/dexatronix/locations?aisles=A1&page=1&pageSize=50"
```

**Response:**
```json
{
  "success": true,
  "locations": [
    {
      "name": "A1-01",
      "location_type": "rack",
      "aisle": "A",
      "scan_date": "2025-11-18T10:30:00Z",
      "occupancy": 0.85,
      "status": "occupied_with_exact_match",
      "expected_inventory_objects": [...],
      "scanned_markers": [...]
    }
  ],
  "pagination": {
    "first": "...",
    "last": "...",
    "next": "...",
    "prev": null
  },
  "total": 1
}
```

---

### 3. Sync to SmartPick
**POST** `/api/v1/dexatronix/sync`

Fetch all Dexatronix data and convert to SmartPick warehouse model.

**What it does:**
1. Fetches all locations from Dexatronix (paginated)
2. Converts to SmartPick format (locations, products, aisles, zones)
3. Loads into warehouse model
4. Initializes optimizer with synced data

**Example:**
```bash
curl -X POST http://localhost:4010/api/v1/dexatronix/sync
```

**Response:**
```json
{
  "success": true,
  "sync_summary": {
    "locations_synced": 850,
    "products_synced": 423,
    "aisles_synced": 12,
    "zones_synced": 4
  },
  "warehouse_summary": {
    "total_locations": 850,
    "utilization_rate": 78,
    "overall_health_score": 72
  }
}
```

---

### 4. Get Dexatronix Summary
**GET** `/api/v1/dexatronix/summary`

Quick overview statistics from Dexatronix.

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_locations": 850,
    "occupied_locations": 663,
    "empty_locations": 187,
    "average_occupancy": 0.78,
    "aisles": ["A1", "A2", "B1", "B2", "C1"],
    "status_breakdown": {
      "Correct": 720,
      "Warning": 95,
      "Error": 35
    },
    "last_scan_date": "2025-11-18T10:45:00Z"
  }
}
```

---

### 5. Push WMS Data
**POST** `/api/v1/dexatronix/push-wms`

Send expected inventory data to Dexatronix for comparison.

**Request Body:**
```json
{
  "locations": [
    {
      "name": "A1-01-01",
      "aisle": "A1",
      "expected_goods": [
        {
          "marker": "QR-SKU-1001",
          "sku": "SKU-1001",
          "description": "Heavy Pallets",
          "expected_weight_g": 22680,
          "quantity": 2
        }
      ]
    },
    {
      "name": "A1-01-02",
      "aisle": "A1",
      "expected_goods": []
    }
  ],
  "sharedId": "optional-correlation-id"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "result": "created"
  }
}
```

---

### 6. Webhook Endpoint
**POST** `/api/v1/dexatronix/webhook`

Receives scan result notifications from Dexatronix robots.

**Configure in Dexatronix:**
- Webhook URL: `https://your-domain.com/api/v1/dexatronix/webhook`
- Method: POST
- Authentication: Bearer token or API key

**Payload Types:**

**Link-based (default):**
```json
{
  "hydrated": false,
  "data_url": "https://api.service.dexoryview.com/customer-api/v2/locations?...",
  "customer": "planet-express",
  "site": "new-new-york"
}
```

**Full payload (optional):**
```json
{
  "hydrated": "v2",
  "data": [
    {
      "name": "A1-01",
      "aisle": "A",
      "scan_date": "2025-11-18T10:30:00Z",
      "occupancy": 0.85,
      ...
    }
  ],
  "customer": "planet-express",
  "site": "new-new-york"
}
```

**SmartPick automatically:**
- Fetches data if link-based
- Converts to SmartPick format
- Merges with existing warehouse model
- Returns 200 OK immediately

---

## 🔄 Data Conversion

### Dexatronix → SmartPick Mapping

| Dexatronix Field | SmartPick Field | Notes |
|------------------|----------------|-------|
| `name` | `location_id` | Direct mapping |
| `aisle` | `aisle` | Direct mapping |
| `location_type` | Height estimation | block=12", pick=42", rack=60" |
| `occupancy` | `occupancy_percent` | 0-1 → 0-100% |
| `zoning.priority` | `pick_frequency` | high=75, medium=35, low=10 |
| `expected_inventory_objects[].sku` | `sku` | Product identifier |
| `expected_inventory_objects[].expected_weight_g` | `weight_lbs` | Grams → pounds |
| `scan_date` | `scan_date` | ISO timestamp |
| `image_url` | `image_url` | Preserved with token |

### Calculated Fields

**Ergonomic Risk Score:**
```javascript
weight_factor = weight_lbs > 40 ? 3.0 : weight_lbs > 20 ? 1.5 : 1.0
height_factor = (height < 30" || height > 60") ? 2.0 : 1.0
frequency_factor = pick_frequency / 100
risk_score = weight_factor × height_factor × frequency_factor × 100
```

**Pick Frequency from Priority:**
- High priority → 75 picks/day (A-class)
- Medium priority → 35 picks/day (B-class)
- Low priority → 10 picks/day (C-class)

---

## 📊 Workflow Examples

### Example 1: Daily Sync

Sync Dexatronix data every morning:

```bash
# Sync all locations
curl -X POST http://localhost:4010/api/v1/dexatronix/sync

# Get optimization recommendations
curl -X POST http://localhost:4010/api/v1/intelligence/optimize \
  -H "Content-Type: application/json" \
  -d '{"optimize_ergonomics": true, "max_moves": 20}'
```

### Example 2: Aisle-Specific Analysis

Analyze specific aisles after receiving webhook:

```bash
# Fetch specific aisles
curl "http://localhost:4010/api/v1/dexatronix/locations?aisles=A1&aisles=A2"

# Convert and load
# (Webhook does this automatically)
```

### Example 3: Push Updates to Dexatronix

After receiving new inventory:

```bash
curl -X POST http://localhost:4010/api/v1/dexatronix/push-wms \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {
        "name": "A1-01-01",
        "aisle": "A1",
        "expected_goods": [
          {
            "marker": "QR-NEW-001",
            "sku": "NEW-001",
            "quantity": 5
          }
        ]
      }
    ]
  }'
```

---

## 🔐 Security

### Authentication Methods

**Bearer Token (Recommended):**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.service.dexoryview.com/...
```

**Query Parameter:**
```bash
curl "https://api.service.dexoryview.com/...?api_key=YOUR_API_KEY"
```

### Webhook Security

Configure webhook authentication in Dexatronix dashboard:
- Bearer token in `Authorization` header
- API key in `api_key` query parameter

SmartPick validates incoming webhooks and returns 200 even on errors to prevent retry storms.

---

## 🧪 Testing

### Unit Tests

```bash
cd backend
node test-dexatronix.js
```

Expected: 7/7 tests passing

### Integration Test

```bash
# 1. Configure credentials in .env
echo "DEXATRONIX_API_KEY=your-key" >> .env
echo "DEXATRONIX_CUSTOMER=your-customer" >> .env
echo "DEXATRONIX_SITE=your-site" >> .env

# 2. Start server
node smartpick-server.js

# 3. Test connection
curl http://localhost:4010/api/v1/dexatronix/test

# 4. Sync data
curl -X POST http://localhost:4010/api/v1/dexatronix/sync
```

---

## 📈 Monitoring

### Health Checks

**Dexatronix Connection:**
```bash
curl http://localhost:4010/api/v1/dexatronix/test
```

**SmartPick Warehouse State:**
```bash
curl http://localhost:4010/api/v1/intelligence/summary
```

### Logs

Watch server logs for Dexatronix activity:

```
📡 [Dexatronix] Fetching locations: ...
📊 [Dexatronix] Fetched page 1, total locations: 100
🔄 [Dexatronix] Starting full sync...
✅ [Dexatronix] Converted to SmartPick format
📨 [Dexatronix] Webhook received
```

---

## 🐛 Troubleshooting

### Issue: "Dexatronix client not configured"

**Solution:** Set environment variables:
```bash
export DEXATRONIX_API_KEY=your-key
export DEXATRONIX_CUSTOMER=your-customer
export DEXATRONIX_SITE=your-site
```

### Issue: "Incorrect API key" (401)

**Solution:** Verify API key in Dexatronix dashboard. Keys are customer/site-specific.

### Issue: No locations returned

**Solution:** Check:
- Site has active robot scans
- Data is within freshness window (8 days default)
- Use `up_to` parameter for older data

### Issue: Webhook not triggering

**Solution:**
- Verify webhook URL is publicly accessible
- Check Dexatronix webhook configuration
- Review server logs for incoming requests
- Test with curl: `curl -X POST http://localhost:4010/api/v1/dexatronix/webhook -d '{"test": true}'`

---

## 🎯 Best Practices

1. **Daily Sync**: Schedule full sync every 24 hours
2. **Webhooks**: Use for real-time updates between syncs
3. **Aisle Filtering**: Fetch specific aisles for targeted analysis
4. **Error Handling**: Webhook endpoint returns 200 to prevent retry storms
5. **Metadata**: Preserve Dexatronix metadata in `dexatronix_metadata` field
6. **Images**: Access via `image_url` field (includes auth token)

---

## 📚 API Reference

Full Dexatronix API documentation:
https://api.service.dexoryview.com/

SmartPick endpoints:
- Test: GET `/api/v1/dexatronix/test`
- Locations: GET `/api/v1/dexatronix/locations`
- Sync: POST `/api/v1/dexatronix/sync`
- Summary: GET `/api/v1/dexatronix/summary`
- Push WMS: POST `/api/v1/dexatronix/push-wms`
- Webhook: POST `/api/v1/dexatronix/webhook`

---

## ✅ Integration Complete

Your SmartPick AI platform now has real-time warehouse intelligence from Dexatronix robots! 🎉

**Next Steps:**
1. Configure webhook in Dexatronix dashboard
2. Run initial sync: `POST /api/v1/dexatronix/sync`
3. Generate optimization plan: `POST /api/v1/intelligence/optimize`
4. Review AI recommendations: `GET /api/v1/intelligence/summary`

**Support:**
- SmartPick Issues: Check server logs
- Dexatronix Issues: Contact Dexory support
- Integration: See troubleshooting section above
