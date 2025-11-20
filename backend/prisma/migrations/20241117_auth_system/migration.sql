-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SAFETY_OFFICER', 'SUPERVISOR', 'OPERATOR');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM (
  'VIEW_ALL_WAREHOUSES',
  'MANAGE_WAREHOUSES',
  'VIEW_ALL_ZONES',
  'MANAGE_ZONES',
  'VIEW_ALL_ALERTS',
  'MANAGE_ALERTS',
  'ACKNOWLEDGE_ALERTS',
  'VIEW_ALL_METRICS',
  'VIEW_OWN_METRICS',
  'MANAGE_USERS',
  'MANAGE_RULES',
  'VIEW_REPORTS',
  'EXPORT_DATA'
);

-- AlterTable User
ALTER TABLE "users" 
  DROP COLUMN "role",
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "last_login_at" TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP DEFAULT now();

-- CreateTable RefreshToken
CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMP
);

-- CreateTable UserRole
CREATE TABLE "user_roles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- CreateTable UserWarehouse
CREATE TABLE "user_warehouses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "warehouse_id" TEXT NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE("user_id", "warehouse_id")
);

-- CreateTable UserZone
CREATE TABLE "user_zones" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "zone_id" TEXT NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE("user_id", "zone_id")
);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX "user_warehouses_user_id_idx" ON "user_warehouses"("user_id");
CREATE INDEX "user_warehouses_warehouse_id_idx" ON "user_warehouses"("warehouse_id");
CREATE INDEX "user_zones_user_id_idx" ON "user_zones"("user_id");
CREATE INDEX "user_zones_zone_id_idx" ON "user_zones"("zone_id");
