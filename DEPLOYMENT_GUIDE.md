# SmartPick AI - Production Deployment Guide

## Architecture Overview

SmartPick AI is a **Human-Machine Bond System (HMBS)** that fuses warehouse robot telemetry (Dex), human observations, and AI-powered optimization into a unified operational intelligence platform.

### Components
- **Frontend**: Next.js 15 + React 18 (port 3500)
- **Backend**: Express.js + NestJS hybrid (port 4010)
- **Intelligence Engine**: OpenAI GPT-4o + Vision API
- **Dex Integration**: Real-time warehouse robot scan sync

---

## Prerequisites

- Node.js 22+
- Docker (optional, for containerized deployment)
- PostgreSQL 16+ (if using database features)
- OpenAI API key
- Dexatronix API credentials (optional)

---

## Environment Variables

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4010/api
NEXT_PUBLIC_WS_URL=http://localhost:4010
PORT=3500
NODE_ENV=production
```

### Backend (`.env`)
```env
PORT=4010
NODE_ENV=production

# OpenAI (required for intelligence features)
OPENAI_API_KEY=sk-...

# Dexatronix (optional)
DEXATRONIX_API_KEY=your-api-key
DEXATRONIX_CUSTOMER=your-customer-slug
DEXATRONIX_SITE=your-site-slug
DEXATRONIX_API_VERSION=v2
DEXATRONIX_BASE_URL=https://api.service.dexoryview.com

# Database (optional, for persistence)
DATABASE_URL=postgres://user:pass@localhost:5432/smartpick

# Security
JWT_SECRET=your-super-secret-key-min-32-chars
```

---

## Local Development

### 1. Install Dependencies
```powershell
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Start Services
```powershell
# Terminal 1 - Backend
cd backend
$env:PORT=4010; node smartpick-server.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 3. Access
- Frontend: http://localhost:3500
- Backend API: http://localhost:4010/api
- Clarity Dashboard: http://localhost:3500/clarity
- Dex Dash: http://localhost:3500/dex-dash

---

## Production Build

### Frontend
```powershell
cd frontend
npm run build
npm start
```

### Backend
```powershell
cd backend
# For NestJS compiled version
npm run build
node dist/main.js

# OR for Express standalone
node smartpick-server.js
```

---

## Docker Deployment

### Build Images
```powershell
# Frontend
docker build -t smartpick-frontend:latest ./frontend

# Backend
docker build -t smartpick-backend:latest ./backend
```

### Run with Docker Compose
```powershell
docker compose up -d
```

---

## Health Checks

### Backend
```powershell
# Express server
Invoke-RestMethod http://localhost:4010/api/health

# Dex integration
Invoke-RestMethod http://localhost:4010/api/v1/dexatronix/test
```

### Frontend
```powershell
Invoke-WebRequest http://localhost:3500 -UseBasicParsing
```

---

## Monitoring & Observability

### Key Metrics
- **Occupancy Rate**: Real-time from Dex summary endpoint
- **API Latency**: Monitor `/api/v1/dexatronix/*` response times
- **Error Rate**: Track 4xx/5xx from ErrorBoundary logs

### Recommended Tools
- **APM**: Datadog, New Relic, or Sentry
- **Logs**: Winston (backend), console (frontend → shipped to APM)
- **Uptime**: UptimeRobot, Pingdom

---

## Security Checklist

- [ ] Rotate `JWT_SECRET` before production
- [ ] Enable HTTPS/TLS (reverse proxy: nginx, Caddy)
- [ ] Restrict CORS origins in backend
- [ ] Rate limit API endpoints (express-rate-limit)
- [ ] Validate all user inputs
- [ ] Sanitize photo uploads (file type, size)
- [ ] Secure Dexatronix API keys (use secrets manager)
- [ ] Enable CSP headers in Next.js config

---

## Performance Optimization

### Frontend
- [x] Font preloading (Inter)
- [x] Lazy loading images
- [x] Request timeouts (15s)
- [ ] CDN for static assets
- [ ] Service worker for offline support

### Backend
- [x] Connection pooling (if using DB)
- [ ] Redis caching for Dex summary
- [ ] Response compression (gzip)
- [ ] Horizontal scaling (multiple instances)

---

## Troubleshooting

### Frontend won't start
- Check port 3500 availability: `Get-NetTCPConnection -LocalPort 3500`
- Verify `.env.local` exists
- Clear `.next` folder: `Remove-Item -Recurse .next`

### Backend API errors
- Check port 4010: `Get-NetTCPConnection -LocalPort 4010`
- Verify `OPENAI_API_KEY` is set
- Check `smartpick-server.js` logs

### Dex integration not working
- Run test: `Invoke-RestMethod http://localhost:4010/api/v1/dexatronix/test`
- Verify credentials in `.env`
- Check Dexatronix API status

---

## Backup & Recovery

### Data to backup
- Frontend `.env.local`
- Backend `.env`
- Uploaded photos (if persisted)
- Database (if used)

### Recovery steps
1. Restore environment files
2. Redeploy containers/services
3. Verify health checks
4. Test critical paths (Clarity dashboard, Dex sync)

---

## Support & Documentation

- **System Architecture**: See `INTELLIGENCE_ENGINE.md`
- **Dex Integration**: See `DEXATRONIX_INTEGRATION.md`
- **Human-Machine Bond**: See `.github/copilot-instructions.md`

---

## License

Proprietary - SmartPick AI Platform
