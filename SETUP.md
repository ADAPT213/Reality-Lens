# SmartPick AI - Complete Setup Guide

## ✨ Quick Start (One Command)

```powershell
.\start-all.ps1
```

This starts:
- Docker services (Postgres + Redis) if available
- Backend (NestJS → Express fallback) on port **4010**
- Frontend (Next.js) on port **3500**

---

## 🏗️ Build Everything

### Option 1: Visual Studio (Recommended)
1. Open `SmartPickAI.sln`
2. Press **Ctrl+Shift+B** (Build Solution)
3. Visual Studio runs `build-all.ps1` automatically

### Option 2: PowerShell
```powershell
.\build-all.ps1
```

### Option 3: Individual builds
```powershell
cd backend
npm ci
npm run build

cd ../frontend
npm ci
npm run build
```

---

## 🚀 Start Services

### Full Platform
```powershell
.\start-all.ps1
```

### Without Docker Services
```powershell
.\start-all.ps1 -NoServices
```

### Without Rebuild
```powershell
.\start-all.ps1 -NoBuild
```

### Individual Services
```powershell
# Start Docker services (Postgres + Redis)
.\scripts\start-services.ps1

# Start backend only (port 4010)
.\scripts\start-backend.ps1

# Start frontend only (port 3500)
.\scripts\start-frontend.ps1
```

---

## 🔧 Configuration

### Backend Environment Variables
Create `backend/.env`:
```env
PORT=4010
NODE_ENV=development
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE  # Optional - runs in fallback mode if missing
DATABASE_URL=postgres://postgres:postgres@localhost:5432/smartpick
JWT_SECRET=your-super-secret-key-change-this-in-production-32chars
REDIS_URL=redis://localhost:6379

# Note: Dexatronix API is kept as a concept
# All automation uses Clarity ergonomic logic
```

### Frontend Environment Variables
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4010
NEXT_PUBLIC_WS_URL=ws://localhost:4010
```

---

## 🎯 Key Features

### Backend (Port 4010)
- **Automated Warehouse Intelligence**: 300-location simulator with 30-second auto-scanning
- **NestJS → Express Fallback**: Tries TypeScript build first, falls back to Express automatically
- **OpenAI Optional**: Runs in rule-based mode if API key missing
- **Full REST API**: Clarity, Slotting, Vision, Analytics, Alerts, Reports, Dexatronix

### Frontend (Port 3500)
- **Next.js 15** with React 18
- **Real-time Dashboard**: WebSocket updates
- **Clarity Module**: Ergonomic risk visualization
- **Vision Analysis**: Safety zone detection
- **3D Layout Viewer**: Interactive warehouse model

---

## 📡 API Endpoints

| Module | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Health | `/api/health` | GET | System status |
| AI Assistant | `/api/v1/assistant/ask` | POST | Natural language queries |
| Clarity | `/api/v1/clarity/zones/risk-analysis` | GET | Ergonomic risk analysis |
| Slotting | `/api/v1/slotting/optimization-plan` | GET | Move plan generation |
| Vision | `/api/v1/vision/zone-classification` | GET | Safety zone detection |
| Analytics | `/api/v1/analytics/dashboard` | GET | Real-time KPIs |
| Automation | `/api/automation/status` | GET | Live warehouse status |
| Dexatronix | `/api/v1/dexatronix/sync` | POST | Robot integration |

Full API docs: `http://localhost:4010/api/docs` (Swagger in development mode)

---

## 🛠️ Troubleshooting

### Backend won't start
1. Check if port 4010 is in use: `Get-NetTCPConnection -LocalPort 4010`
2. Kill existing processes: `Stop-Process -Name node -Force`
3. Try Express fallback: `cd backend; node smartpick-server.js`

### Frontend won't start
1. Check if port 3500 is in use: `Get-NetTCPConnection -LocalPort 3500`
2. Clear Next.js cache: `cd frontend; Remove-Item -Recurse -Force .next`
3. Reinstall: `npm ci`

### Build fails
1. Clean output: `.\scripts\clean-all.ps1`
2. Delete node_modules: `Remove-Item -Recurse -Force backend\node_modules,frontend\node_modules`
3. Fresh install: `.\build-all.ps1`

### Docker services won't start
1. Check Docker Desktop is running
2. Verify docker-compose.yml exists
3. Manual start: `docker compose up -d`

---

## 📦 Tech Stack

**Backend:**
- NestJS 10 (TypeScript)
- Express.js (fallback)
- OpenAI GPT-4o-mini (optional)
- Prisma ORM
- Redis
- PostgreSQL
- Socket.io (WebSockets)

**Frontend:**
- Next.js 15
- React 18
- TailwindCSS
- TypeScript

**Infrastructure:**
- Docker Compose
- Node.js 22+
- PowerShell 5.1+

---

## 🔐 Security Notes

- Change `JWT_SECRET` in production
- Never commit `.env` files
- Use environment-specific secrets
- Enable HTTPS in production
- Rotate API keys regularly

---

## 📚 Additional Scripts

```powershell
# Clean all build artifacts
.\scripts\clean-all.ps1

# Rebuild from scratch
.\scripts\clean-all.ps1; .\build-all.ps1

# Kill all node processes
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```

---

## 🎓 Development Workflow

1. **First time setup:**
   ```powershell
   .\build-all.ps1
   .\start-all.ps1
   ```

2. **Daily development:**
   ```powershell
   .\start-all.ps1 -NoServices -NoBuild
   ```

3. **After code changes:**
   ```powershell
   # Backend only
   cd backend; npm run build

   # Frontend only (hot reload handles this)
   # Just save your files
   ```

4. **Before committing:**
   ```powershell
   .\build-all.ps1  # Verify everything compiles
   ```

---

## 📞 Support

- Backend logs: Check PowerShell windows
- Frontend logs: `http://localhost:3500` (browser console)
- API health: `http://localhost:4010/api/health`

---

**Built with ❤️ for warehouse optimization**
