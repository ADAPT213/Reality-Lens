# WebSocket Production Architecture

## Overview

Production-ready WebSocket infrastructure with Redis adapter for multi-instance broadcasting, connection management, rate limiting, and load testing capabilities.

## Architecture Components

### 1. Redis Adapter (Multi-Instance Broadcasting)
- **File**: `backend/src/websocket/websocket.gateway.ts`
- **Features**:
  - Pub/Sub pattern using `@socket.io/redis-adapter`
  - Horizontal scaling across multiple backend instances
  - Automatic reconnection with exponential backoff
  - Message broadcasting across all server instances

### 2. Connection Manager
- **File**: `backend/src/websocket/connection-manager.service.ts`
- **Features**:
  - Per-connection rate limiting (100 tokens/connection, refill 10/sec)
  - Slow client detection (1000ms threshold)
  - Connection tracking by warehouse/zone
  - Metrics aggregation (total connections, messages, duration)
  - Graceful disconnect handling

### 3. Room-Based Multi-Tenant Isolation
- **Rooms**: `warehouse:{id}`, `zone:{warehouse}:{zone}`
- **Auto-join**: Based on query parameters (`warehouse`, `zone`, `userId`)
- **Dynamic subscription**: `subscribe`/`unsubscribe` events
- **Broadcast methods**: 
  - `broadcastToWarehouse(warehouse, event, data)`
  - `broadcastToZone(warehouse, zone, event, data)`

### 4. Advanced Features
- **Heartbeat**: 30s ping/pong with connection count
- **Compression**: Per-message deflate (threshold: 1KB, zlib default compression)
- **Backpressure**: Max buffer size 1MB per connection
- **Transport Fallback**: WebSocket → Long Polling → SSE
- **Sticky Sessions**: Handled by Redis adapter

### 5. Health & Observability
- **Endpoint**: `GET /health/websocket/metrics`
- **Metrics**:
  - Total connections
  - Average messages per connection
  - Connections by warehouse/zone
  - Average connection duration
- **Logs**: Connection lifecycle, rate limits, errors

### 6. Load Testing
- **File**: `backend/test/load/websocket-load.ts`
- **Capabilities**:
  - Simulate 1000+ concurrent connections
  - Configurable message throughput
  - Latency metrics (min, max, avg, P50, P95, P99)
  - Reconnection testing
  - Multi-warehouse/zone distribution

### 7. Frontend Client
- **File**: `frontend/src/app/lib/websocket-client.ts`
- **Features**:
  - Auto-reconnect with exponential backoff (max 10 attempts)
  - Listener management (attach/detach)
  - Connection state tracking
  - Subscribe/unsubscribe to warehouses/zones
  - TypeScript typed events

## Installation

### Backend Dependencies
```bash
cd backend
npm install @socket.io/redis-adapter socket.io-client
```

### Frontend Dependencies
```bash
cd frontend
npm install socket.io-client
```

## Configuration

### Environment Variables
```env
# Backend (.env)
REDIS_URL=redis://localhost:6379

# Load Test
WS_URL=http://localhost:3001
CONNECTIONS=1000
MSG_PER_SEC=100
DURATION=60
```

### Docker Compose (Add Redis)
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

## Usage

### Backend: Broadcast to Clients
```typescript
// Inject WebsocketGateway
constructor(private wsGateway: WebsocketGateway) {}

// Broadcast to all clients in a warehouse
this.wsGateway.broadcastToWarehouse('warehouse-1', 'ALERT', {
  type: 'high_risk',
  location: 'A-12-3',
  risk: 8.5,
});

// Broadcast to specific zone
this.wsGateway.broadcastToZone('warehouse-1', 'zone-a', 'ZONE_UPDATE', {
  picks: 150,
  avgTime: 45,
});
```

### Frontend: Connect & Subscribe
```typescript
import { createWebSocketClient } from '@/lib/websocket-client';

const ws = createWebSocketClient({
  url: 'http://localhost:3001',
  warehouse: 'warehouse-1',
  zone: 'zone-a',
  userId: 'user-123',
  autoReconnect: true,
});

await ws.connect();

ws.on('SHIFT_SNAPSHOT', (data) => {
  console.log('Shift update:', data);
});

ws.on('ALERT', (data) => {
  console.log('Alert:', data);
});

// Dynamic subscription
ws.subscribe('warehouse-2', 'zone-b');

// Cleanup
ws.disconnect();
```

## Load Testing

### Run Basic Test (1000 connections, 60s)
```bash
cd backend
npx ts-node test/load/websocket-load.ts
```

### Run Stress Test (2000 connections, 120s, 200 msg/s)
```bash
WS_URL=http://localhost:3001 \
CONNECTIONS=2000 \
MSG_PER_SEC=200 \
DURATION=120 \
npx ts-node test/load/websocket-load.ts
```

### Expected Output
```
🚀 Starting WebSocket load test
   Target: http://localhost:3001
   Connections: 1000
   Messages/sec: 100
   Duration: 60s

✓ 1000 connections established

📊 Running load test for 60s...
Elapsed: 60.0s | Sent: 6000 | Received: 5987 | Errors: 0

📈 Load Test Results
==================================================
Duration: 60.23s
Concurrent Connections: 1000
Messages Sent: 6000
Messages Received: 5987
Throughput: 99.42 msg/s

📊 Latency Metrics (ms)
==================================================
Min: 12.45
Max: 234.67
Avg: 45.23
P50: 42.10
P95: 89.34
P99: 156.78

✓ Success Rate: 99.78%
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Concurrent Connections | 10,000+ | Per instance with 4GB RAM |
| Message Latency P95 | < 100ms | Local network, Redis on same host |
| Message Latency P99 | < 250ms | Including network overhead |
| Throughput | 10,000+ msg/s | Across all connections |
| Success Rate | > 99.9% | Message delivery guarantee |
| Reconnection Time | < 2s | Exponential backoff, max 30s |

## Monitoring

### Health Check
```bash
curl http://localhost:3001/health/websocket/metrics
```

Response:
```json
{
  "totalConnections": 1247,
  "avgMessagesPerConnection": 145,
  "connectionsByWarehouse": {
    "warehouse-1": 523,
    "warehouse-2": 724
  },
  "connectionsByZone": {
    "zone-a": 412,
    "zone-b": 835
  },
  "avgConnectionDuration": 3456
}
```

### Redis Monitoring
```bash
redis-cli monitor
redis-cli info clients
redis-cli client list
```

### System Resources
```bash
# CPU/Memory
top -p $(pgrep -f "node.*main.js")

# Network connections
netstat -an | grep :3001 | wc -l

# Socket.IO rooms
redis-cli keys "socket.io#*"
```

## Scaling Strategies

### Horizontal Scaling
1. Deploy multiple backend instances behind load balancer
2. Configure sticky sessions (IP hash or cookie-based)
3. Redis adapter broadcasts messages across all instances
4. Each instance handles subset of connections

### Vertical Scaling
1. Increase Node.js heap size: `--max-old-space-size=4096`
2. Use cluster mode: `pm2 start -i max`
3. Optimize Redis persistence (AOF vs RDB)

### Load Balancer Config (NGINX)
```nginx
upstream websocket_backend {
  ip_hash; # Sticky sessions
  server backend-1:3001;
  server backend-2:3001;
  server backend-3:3001;
}

server {
  location / {
    proxy_pass http://websocket_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
  }
}
```

## Troubleshooting

### High Latency (P95 > 200ms)
- Check Redis network latency: `redis-cli --latency`
- Verify database query performance
- Monitor CPU/memory usage
- Increase compression threshold

### Connection Drops
- Check firewall timeout settings
- Increase `pingTimeout` in gateway config
- Verify load balancer timeout settings
- Check Redis connection stability

### Memory Leaks
- Monitor `this.connections` map size
- Verify all listeners are removed on disconnect
- Use `--inspect` and Chrome DevTools heap profiler
- Check for zombie intervals/timers

### Rate Limiting Triggered
- Review `RATE_LIMIT_TOKENS` and `RATE_LIMIT_REFILL`
- Check client message frequency
- Investigate malicious clients
- Implement per-user limits

## Security Considerations

1. **Authentication**: Add JWT validation in `handleConnection`
2. **Authorization**: Verify warehouse/zone access permissions
3. **Rate Limiting**: Already implemented per-connection
4. **DoS Protection**: Max buffer size, connection limits
5. **TLS**: Use WSS in production (handled by reverse proxy)
6. **CORS**: Configure allowed origins (not `origin: true`)

## Next Steps

1. ✅ Install Redis adapter: `npm install @socket.io/redis-adapter`
2. ✅ Update WebSocket gateway with production features
3. ✅ Create connection manager service
4. ✅ Add room-based multi-tenant isolation
5. ✅ Build load testing script
6. ✅ Add health metrics endpoint
7. ✅ Create frontend auto-reconnect client
8. 🔲 Run load tests and tune parameters
9. 🔲 Configure Redis persistence (AOF)
10. 🔲 Set up monitoring dashboards (Grafana)
11. 🔲 Implement authentication middleware
12. 🔲 Deploy multi-instance behind load balancer

## Benchmarking Commands

```bash
# Baseline (1K connections)
npx ts-node test/load/websocket-load.ts

# Stress test (5K connections)
CONNECTIONS=5000 DURATION=300 npx ts-node test/load/websocket-load.ts

# Message burst (500 msg/s)
CONNECTIONS=1000 MSG_PER_SEC=500 npx ts-node test/load/websocket-load.ts

# Multi-warehouse (100 warehouses, 10 zones each)
for i in {1..100}; do
  WAREHOUSE="warehouse-$i" ZONE="zone-$((i % 10))" CONNECTIONS=100 &
done
```
