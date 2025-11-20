# Role-Permission Matrix

## Quick Reference

| Role | Scope | Primary Responsibilities |
|------|-------|-------------------------|
| **ADMIN** | Global | System configuration, user management |
| **SAFETY_OFFICER** | Global | Safety rules, alert management, compliance reporting |
| **SUPERVISOR** | Warehouse/Zone | Monitoring assigned areas, acknowledging alerts |
| **OPERATOR** | Self | View personal metrics only |

---

## Detailed Permission Breakdown

### 🔴 ADMIN
**Full system access - bypass all tenant restrictions**

| Permission | Access Level | Description |
|-----------|-------------|-------------|
| VIEW_ALL_WAREHOUSES | ✓ Global | View all warehouses across system |
| MANAGE_WAREHOUSES | ✓ Global | Create, edit, delete warehouses |
| VIEW_ALL_ZONES | ✓ Global | View all zones in all warehouses |
| MANAGE_ZONES | ✓ Global | Create, edit, delete zones |
| VIEW_ALL_ALERTS | ✓ Global | View all alerts system-wide |
| MANAGE_ALERTS | ✓ Global | Create, modify alert rules |
| ACKNOWLEDGE_ALERTS | ✓ Global | Acknowledge any alert |
| VIEW_ALL_METRICS | ✓ Global | View all ergonomic metrics |
| MANAGE_USERS | ✓ Global | Create, edit users and assign roles |
| MANAGE_RULES | ✓ Global | Create, edit alert rules |
| VIEW_REPORTS | ✓ Global | Access all reports |
| EXPORT_DATA | ✓ Global | Export any data to CSV/Excel |

**Example Use Cases:**
- Configure system-wide thresholds
- Create new warehouses and zones
- Manage user accounts and role assignments
- Emergency override of any operation

---

### 🟠 SAFETY_OFFICER
**Safety & compliance focus - global view, no user management**

| Permission | Access Level | Description |
|-----------|-------------|-------------|
| VIEW_ALL_WAREHOUSES | ✓ Global | Monitor safety across all facilities |
| VIEW_ALL_ZONES | ✓ Global | Inspect all zones for compliance |
| VIEW_ALL_ALERTS | ✓ Global | Monitor all safety alerts |
| MANAGE_ALERTS | ✓ Global | Create and modify alert rules |
| ACKNOWLEDGE_ALERTS | ✓ Global | Acknowledge and document incidents |
| VIEW_ALL_METRICS | ✓ Global | Analyze ergonomic data for patterns |
| MANAGE_RULES | ✓ Global | Define RULA/REBA/NIOSH thresholds |
| VIEW_REPORTS | ✓ Global | Generate safety compliance reports |
| EXPORT_DATA | ✓ Global | Export for regulatory submissions |

**Example Use Cases:**
- Create alert rule: "RULA score > 7 for 3 consecutive picks"
- Generate monthly OSHA compliance report
- Analyze trends: "Which zones have highest injury risk?"
- Acknowledge critical ergonomic violations

**Cannot Do:**
- Create/delete users
- Modify warehouse structure
- Bypass role restrictions

---

### 🟡 SUPERVISOR
**Operational monitoring - scoped to assigned warehouses/zones**

| Permission | Access Level | Description |
|-----------|-------------|-------------|
| VIEW_ALL_ALERTS | ✓ Scoped | View alerts in assigned warehouses/zones |
| ACKNOWLEDGE_ALERTS | ✓ Scoped | Acknowledge alerts in assigned areas |
| VIEW_ALL_METRICS | ✓ Scoped | View metrics for assigned zones |
| VIEW_REPORTS | ✓ Scoped | Reports for assigned areas only |

**Scope Enforcement:**
- TenantGuard checks `UserWarehouse` and `UserZone` tables
- Can only access data for explicitly assigned warehouses/zones
- Admin-level users bypass these restrictions

**Example Use Cases:**
- Monitor alerts for "Warehouse A - Zone 1"
- Acknowledge high-RULA alert for Location L-42
- View team metrics for assigned shift
- Generate daily summary report for assigned zone

**Cannot Do:**
- Create or modify alert rules
- Access data outside assigned warehouses/zones
- Export data
- Manage users

---

### 🟢 OPERATOR
**Self-service only - individual ergonomic tracking**

| Permission | Access Level | Description |
|-----------|-------------|-------------|
| VIEW_OWN_METRICS | ✓ Self | View personal ergonomic scores and history |

**Scope Enforcement:**
- Filtered by `userId` in queries
- No access to other operators' data
- No access to alerts or rules

**Example Use Cases:**
- View personal RULA/REBA scores over time
- Check daily ergonomic performance
- See personal improvement trends

**Cannot Do:**
- View other operators' data
- Access alerts
- View reports
- Export data

---

## Controller Implementation Examples

### Alerts Controller
```typescript
@Controller('alerts')
@RequireTenant()  // Enforce warehouse/zone scoping
export class AlertsController {
  
  // ADMIN, SAFETY_OFFICER, SUPERVISOR (scoped)
  @Get()
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async getAlerts(@Query('warehouseId') warehouseId: string) {
    // TenantGuard ensures supervisors can only access assigned warehouses
  }

  // ADMIN, SAFETY_OFFICER, SUPERVISOR (scoped)
  @Post(':id/acknowledge')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async acknowledgeAlert(@CurrentUser('userId') userId: string) {
    // Auto-logged as acknowledger
  }

  // ADMIN, SAFETY_OFFICER only
  @Post('rules')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  async createRule(@Body() dto: CreateRuleDto) {}
}
```

### Metrics Controller
```typescript
@Controller('metrics')
export class MetricsController {
  
  // ADMIN, SAFETY_OFFICER (global), SUPERVISOR (scoped)
  @Get('warehouse/:warehouseId')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  @RequireTenant()
  async getWarehouseMetrics(@Param('warehouseId') id: string) {}

  // OPERATOR only - self metrics
  @Get('me')
  @Roles(Role.OPERATOR)
  async getOwnMetrics(@CurrentUser('userId') userId: string) {
    // Filtered by userId automatically
  }
}
```

### Reports Controller
```typescript
@Controller('reports')
export class ReportsController {
  
  // ADMIN, SAFETY_OFFICER (global), SUPERVISOR (scoped)
  @Get('ergonomic-summary')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  @RequireTenant()
  async getErgonomicSummary(@Query('warehouseId') warehouseId: string) {}

  // ADMIN, SAFETY_OFFICER only
  @Post('export')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  async exportData(@Body() dto: ExportDto) {}
}
```

---

## User Assignment Workflow

### Creating a Supervisor for Warehouse A, Zone 1

```sql
-- 1. Create user
INSERT INTO users (id, email, password_hash, first_name, last_name)
VALUES ('uuid-123', 'john.supervisor@company.com', 'hashed_pwd', 'John', 'Doe');

-- 2. Assign SUPERVISOR role
INSERT INTO user_roles (id, user_id, role)
VALUES ('uuid-456', 'uuid-123', 'SUPERVISOR');

-- 3. Assign to Warehouse A
INSERT INTO user_warehouses (id, user_id, warehouse_id)
VALUES ('uuid-789', 'uuid-123', 'warehouse-a-id');

-- 4. Assign to Zone 1 (optional, more granular control)
INSERT INTO user_zones (id, user_id, zone_id)
VALUES ('uuid-101', 'uuid-123', 'zone-1-id');
```

### TenantGuard Behavior
```typescript
// Request: GET /api/alerts?warehouseId=warehouse-a-id
// User: John (Supervisor assigned to Warehouse A)

TenantGuard checks:
1. Is user ADMIN? No → proceed to tenant check
2. Does user have access to warehouse-a-id?
   - Query: SELECT * FROM user_warehouses WHERE user_id = 'uuid-123' AND warehouse_id = 'warehouse-a-id'
   - Result: Found → ALLOW
3. If not found → 403 Forbidden
```

---

## Migration Path

### Phase 1: Database Migration
```bash
cd backend
npm run prisma:generate
npm run migrate:dev
```

### Phase 2: Seed Test Users
```bash
npm run seed:users
```

### Phase 3: Update Controllers
Add decorators to existing controllers:
- `@Roles(...)` for all endpoints
- `@RequireTenant()` for warehouse/zone-scoped controllers
- `@Public()` for health checks

### Phase 4: Frontend Integration
```typescript
// Wrap app with AuthProvider
<AuthProvider>
  <AppContent />
</AuthProvider>

// Protected routes
export default withAuth(DashboardPage, [Role.ADMIN, Role.SUPERVISOR]);

// API calls
const { get } = useApi();
await get('/alerts'); // Token auto-attached
```

---

## Testing Matrix

| User | Endpoint | Expected Result |
|------|----------|-----------------|
| admin@smartpick.com | GET /alerts | ✓ All alerts |
| admin@smartpick.com | POST /alerts/rules | ✓ Created |
| safety@smartpick.com | GET /alerts | ✓ All alerts |
| safety@smartpick.com | POST /alerts/rules | ✓ Created |
| safety@smartpick.com | POST /users | ✗ 403 Forbidden |
| supervisor@smartpick.com | GET /alerts?warehouseId=assigned | ✓ Filtered alerts |
| supervisor@smartpick.com | GET /alerts?warehouseId=other | ✗ 403 Forbidden |
| supervisor@smartpick.com | POST /alerts/rules | ✗ 403 Forbidden |
| operator@smartpick.com | GET /metrics/me | ✓ Own metrics |
| operator@smartpick.com | GET /alerts | ✗ 403 Forbidden |

---

## Security Checklist

- [x] JWT with short expiry (15m)
- [x] Refresh token rotation
- [x] Password hashing (bcrypt)
- [x] Role-based access control
- [x] Tenant isolation
- [x] Rate limiting on login
- [x] Global validation pipe
- [x] Request logging
- [ ] Audit trail for sensitive actions
- [ ] 2FA for admin accounts
- [ ] IP whitelisting
- [ ] CSRF protection (production)
