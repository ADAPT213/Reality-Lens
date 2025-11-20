# WebSocket Scaling Dependencies Installation

## Backend Dependencies

Close VS Code and any Node processes, then run:

```bash
cd backend
npm install @socket.io/redis-adapter@^8.3.0 redis@^4.7.0 socket.io-client@^4.8.0
```

## Frontend Dependencies

```bash
cd frontend
npm install socket.io-client@^4.8.0
```

## Redis Setup (Docker)

Add to `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

Start Redis:

```bash
docker-compose up -d redis
```

## Verify Installation

```bash
# Check Redis connection
redis-cli ping
# Should return: PONG

# Check backend packages
cd backend && npm list @socket.io/redis-adapter redis socket.io-client

# Run load test
npm run test:load:ws
```

## Environment Configuration

Add to `backend/.env`:

```env
REDIS_URL=redis://localhost:6379
```

## Troubleshooting

### Windows File Lock Issues

If `npm install` fails with EBUSY errors:

1. Close VS Code completely
2. Close any PowerShell/CMD windows
3. Run `taskkill /F /IM node.exe` (if needed)
4. Retry installation

### Redis Connection Errors

If WebSocket gateway fails to connect to Redis:

- Verify Redis is running: `docker ps | grep redis`
- Check connection: `redis-cli -h localhost -p 6379 ping`
- Review logs: `docker logs <redis-container-id>`
