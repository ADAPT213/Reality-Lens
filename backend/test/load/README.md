# WebSocket Load Testing

## Installation

```bash
npm install socket.io-client --save-dev
npm install @types/node --save-dev
```

## Running Tests

### Basic Test (1000 connections, 60s)

```bash
npx ts-node test/load/websocket-load.ts
```

### Custom Configuration

```bash
WS_URL=http://localhost:3001 \
CONNECTIONS=2000 \
MSG_PER_SEC=200 \
DURATION=120 \
npx ts-node test/load/websocket-load.ts
```

### Environment Variables

- `WS_URL`: WebSocket server URL (default: http://localhost:3001)
- `CONNECTIONS`: Number of concurrent connections (default: 1000)
- `MSG_PER_SEC`: Messages per second to send (default: 100)
- `DURATION`: Test duration in seconds (default: 60)
- `WAREHOUSE`: Warehouse ID to subscribe to (optional)
- `ZONE`: Zone ID to subscribe to (optional)

## Performance Benchmarks

### Target Metrics

- **Concurrent Connections**: 10,000+
- **Message Latency P95**: < 100ms
- **Message Latency P99**: < 250ms
- **Throughput**: 10,000+ msg/s
- **Success Rate**: > 99.9%
- **Reconnection Time**: < 2s

### Recommended Test Scenarios

1. **Connection Storm**: 5000 connections in 10s
2. **Sustained Load**: 2000 connections for 300s
3. **Message Burst**: 1000 connections, 500 msg/s
4. **Reconnection Test**: Restart server mid-test
5. **Zone Isolation**: 1000 connections across 100 warehouses

## Monitoring During Tests

```bash
# Watch connection metrics
curl http://localhost:3001/health/websocket/metrics

# Monitor Redis
redis-cli monitor

# Check system resources
top -p $(pgrep -f "node.*main.js")
```

## Interpreting Results

- **Success Rate < 95%**: Increase server resources or optimize message handling
- **P95 Latency > 200ms**: Check network, Redis, or database performance
- **Reconnections > 5%**: Investigate server stability or load balancer config
- **High Error Rate**: Check logs for connection limits or resource exhaustion
