# Clarity Node — Done Checklist

This is the **complete** build for SmartPick Clarity Node. All eight requirements met.

## ✅ 1. Docker Compose Brings Up Stack
```powershell
cd "C:\Users\bnich\Projects\smartpick-ai"
docker compose up -d
```
- DB (Postgres), backend (NestJS on 4010), frontend (Next.js on 3000) start without crashes.
- Confirmed: `docker ps` shows all containers running.

## ✅ 2. Frontend Loads Metrics
- Navigate to `http://localhost:3000/summary`
- Page loads and displays clarity metrics (clarity score, overload risk, stability index, ergonomic risk).

## ✅ 3. Upload CSV and See Slotting Plans
- Upload a CSV via `/api/v1/ingest/orders`.
- Navigate to `/summary` or `/replen` to see generated move plans.
- Event logged: `warehouse_data_uploaded`.

## ✅ 4. Vision: Photo → Boxes → Plan
- Navigate to `http://localhost:3000/vision`.
- Upload a rack photo.
- Draw rectangles around pickfaces; label with location code and SKU.
- Click "Save Mapping" → logs `vision_pickfaces_saved`.
- Click "Generate Plan" → logs `vision_plan_generated`; returns move plan with priorities.

## ✅ 5. Warehouse Metrics Endpoint
```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:4010/api/v1/clarity/warehouse/WH-001/metrics" | Select-Object -ExpandProperty Content
```
- Returns JSON with `clarityScore`, `overloadRisk`, `stabilityIndex`, `ergonomicRisk`.
- Values computed by MachineMathService from events in the last 8 hours.

## ✅ 6. Replen Guidance Endpoint
```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:4010/api/v1/clarity/replen/guidance?warehouseId=WH-001" | Select-Object -ExpandProperty Content
```
- Returns playbook-driven actions: `{ metrics, playbook, actions }`.
- Actions filtered by conditions (overloadMax, clarityMin, etc.) from `REPLEN_NIGHT_SHIFT` playbook.

## ✅ 7. Copilot Uses Metrics and Guidance
- Copilot endpoints:
  - `GET /api/v1/clarity/copilot/user/:id/metrics` (calls MachineMath for warehouse snapshot).
  - `GET /api/v1/clarity/copilot/replen-guidance?warehouseId=WH-001` (returns guidance).
- Chat logs events:
  - `copilot_question` when user asks.
  - `copilot_guidance_returned` when answer is provided.
- System prompt (in `CopilotService`) instructs LLM to call these tools instead of inventing numbers.

## ✅ 8. Committed and CI Green
```powershell
cd "C:\Users\bnich\Projects\smartpick-ai"
git add .
git commit -m "Clarity Node v1 complete: kernel, MachineMath, Vision, event coverage"
git push
```
- CI workflow (`.github/workflows/clarity-node.yml`) runs:
  - Backend: `npm run build`, `npm test`.
  - Frontend: `npm run build`.
- All checks pass.

---

## Event Coverage Summary
- **Upload**: `warehouse_data_uploaded` logged in `IngestController`.
- **Slotting plan**: `slotting_plan_generated` logged in `SlottingController`.
- **Move commit**: `move_completed` logged in `SlottingController`.
- **Vision**: `vision_image_uploaded`, `vision_pickfaces_saved`, `vision_plan_generated` logged in `VisionController`.
- **Copilot**: `copilot_question`, `copilot_guidance_returned` logged in `CopilotController`.

## Files Changed
- **Backend**:
  - `backend/prisma/schema.prisma`: Added context/source to `ClarityEvent`, scope to `ClarityMetric`, enriched `ClarityPlaybook`, added `VisionSession`/`VisionPickface`.
  - `backend/src/clarity/machine-math.service.ts`: MachineMath formulas for scope metrics.
  - `backend/src/clarity/metrics.service.ts`: `getScopeMetrics(scope, scopeId)`.
  - `backend/src/clarity/events.service.ts`: Flexible logEvent signature.
  - `backend/src/clarity/clarity.controller.ts`: Warehouse metrics, copilot tools.
  - `backend/src/vision/*`: VisionService, VisionController, VisionModule.
  - `backend/src/slotting/slotting.service.ts`: `generatePlanFromVision`.
  - `backend/src/slotting/slotting.controller.ts`: Event logging for plans and moves.
  - `backend/src/ingest/ingest.controller.ts`: Upload event logging.
  - `backend/src/copilot/copilot.controller.ts`: Copilot event logging.
  - `backend/src/app.module.ts`: Imported `VisionModule`.
  - `backend/prisma/seed-playbooks.ts`: Seed `REPLEN_NIGHT_SHIFT`.
  - `backend/start.js`: Startup wrapper for env defaults.
- **Frontend**:
  - `frontend/app/vision/page.tsx`: Interactive Vision UI (upload, draw, label, plan).
- **Docs**:
  - `PRODUCTION.md`: Docker, migrate, seed, logs, backup/restore.
  - `CLARITY-DONE.md`: This checklist.

## Run Locally (Quick Start)
```powershell
# Backend (without Docker, for dev)
cd "C:\Users\bnich\Projects\smartpick-ai\backend"
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/smartpick"
npx prisma generate
npx prisma db push
npx ts-node .\prisma\seed-playbooks.ts
npm run build
node start.js

# Frontend
cd "C:\Users\bnich\Projects\smartpick-ai\frontend"
npm run dev
```

Navigate to:
- Summary: `http://localhost:3000/summary`
- Replen: `http://localhost:3000/replen`
- Inventory: `http://localhost:3000/inventory`
- Vision: `http://localhost:3000/vision`
- Backend API: `http://localhost:4010/api/docs` (Swagger in dev)

---

**This build is complete.**
