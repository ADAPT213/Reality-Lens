# SmartPick AI — Production Guide

## Prerequisites
- Docker Desktop
- Node.js (for local development) optional

## Bring Up Stack
```bash
# From repo root
docker compose up -d
```

## Initialize Database Schema
```bash
cd backend
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/smartpick"
npx prisma migrate deploy
npx ts-node prisma/seed-playbooks.ts
```

## Tail Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Backup Database
```bash
docker exec -t smartpick-ai-db pg_dump -U postgres smartpick > backup.sql
```

## Restore Database
```bash
Get-Content backup.sql | docker exec -i smartpick-ai-db psql -U postgres smartpick
```
