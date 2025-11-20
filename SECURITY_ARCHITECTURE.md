# Security Architecture & RBAC Documentation

## Authentication System

### Token Strategy
- **Access Tokens**: Short-lived (15 minutes), JWT signed with HS256
- **Refresh Tokens**: Long-lived (7 days), stored hashed in database
- **Algorithm**: HS256 (can be upgraded to RS256 with key rotation)
- **Storage**: 
  - Frontend: Cookies (httpOnly recommended for production)
  - Backend: RefreshToken table with hash + expiry

### Token Flow
```
1. Login → Access Token (15m) + Refresh Token (7d)
2. API Request → Bearer Token in Authorization header
3. Token Expires → Auto-refresh 5min before expiry
4. Refresh Fails → Redirect to login
5. Logout → Revoke all refresh tokens
```

## Authorization System (RBAC)

### Role Hierarchy

#### 1. ADMIN
**Permissions**: Full system access
- `VIEW_ALL_WAREHOUSES`, `MANAGE_WAREHOUSES`
- `VIEW_ALL_ZONES`, `MANAGE_ZONES`
- `VIEW_ALL_ALERTS`, `MANAGE_ALERTS`, `ACKNOWLEDGE_ALERTS`
- `VIEW_ALL_METRICS`
- `MANAGE_USERS`, `MANAGE_RULES`
- `VIEW_REPORTS`, `EXPORT_DATA`

**Typical Use Cases**:
- System configuration
- User management
- Global operations

---

#### 2. SAFETY_OFFICER
**Permissions**: Safety & compliance oversight
- `VIEW_ALL_WAREHOUSES`
- `VIEW_ALL_ZONES`
- `VIEW_ALL_ALERTS`, `MANAGE_ALERTS`, `ACKNOWLEDGE_ALERTS`
- `VIEW_ALL_METRICS`
- `MANAGE_RULES`
- `VIEW_REPORTS`, `EXPORT_DATA`

**Typical Use Cases**:
- Create/modify alert rules
- Monitor all ergonomic violations
- Generate safety reports
- Export compliance data

---

#### 3. SUPERVISOR
**Permissions**: Operational monitoring (warehouse/zone scoped)
- `VIEW_ALL_ALERTS`, `ACKNOWLEDGE_ALERTS`
- `VIEW_ALL_METRICS`
- `VIEW_REPORTS`

**Scope Restrictions**:
- Limited to assigned warehouses via `UserWarehouse`
- Limited to assigned zones via `UserZone`

**Typical Use Cases**:
- Monitor alerts in assigned zones
- Acknowledge incidents
- View team performance metrics

---

#### 4. OPERATOR
**Permissions**: Self-service only
- `VIEW_OWN_METRICS`

**Scope Restrictions**:
- Can only view their own ergonomic scores
- No access to alerts or rules

**Typical Use Cases**:
- View personal ergonomic data
- Track own performance

---

## Role-Permission Matrix

| Permission              | ADMIN | SAFETY_OFFICER | SUPERVISOR | OPERATOR |
|------------------------|-------|----------------|------------|----------|
| VIEW_ALL_WAREHOUSES    | ✓     | ✓              | -          | -        |
| MANAGE_WAREHOUSES      | ✓     | -              | -          | -        |
| VIEW_ALL_ZONES         | ✓     | ✓              | -          | -        |
| MANAGE_ZONES           | ✓     | -              | -          | -        |
| VIEW_ALL_ALERTS        | ✓     | ✓              | ✓*         | -        |
| MANAGE_ALERTS          | ✓     | ✓              | -          | -        |
| ACKNOWLEDGE_ALERTS     | ✓     | ✓              | ✓*         | -        |
| VIEW_ALL_METRICS       | ✓     | ✓              | ✓*         | -        |
| VIEW_OWN_METRICS       | ✓     | ✓              | ✓          | ✓        |
| MANAGE_USERS           | ✓     | -              | -          | -        |
| MANAGE_RULES           | ✓     | ✓              | -          | -        |
| VIEW_REPORTS           | ✓     | ✓              | ✓          | -        |
| EXPORT_DATA            | ✓     | ✓              | -          | -        |

*\* Scoped to assigned warehouses/zones via TenantGuard*

---

## Guards & Decorators

### Guards (Applied Globally)

1. **JwtAuthGuard** (Primary)
   - Validates Bearer token from Authorization header
   - Populates `request.user` with UserPayload
   - Allows `@Public()` routes

2. **RolesGuard** (Secondary)
   - Checks `@Roles(Role.ADMIN, Role.SAFETY_OFFICER)`
   - Validates user has at least one required role

3. **TenantGuard** (Tertiary)
   - Enforces warehouse/zone isolation
   - Triggered by `@RequireTenant()`
   - Extracts `warehouseId`/`zoneId` from params/query/body
   - Admins bypass tenant checks

### Decorators

```typescript
// Make endpoint public (bypass auth)
@Public()

// Require specific roles
@Roles(Role.ADMIN, Role.SAFETY_OFFICER)

// Enforce tenant isolation
@RequireTenant()

// Get current user
@CurrentUser() user: UserPayload
@CurrentUser('userId') userId: string
```

---

## Example Controller Implementation

```typescript
@Controller('alerts')
@RequireTenant()  // Enforce warehouse/zone isolation
export class AlertsController {
  
  // Only admins, safety officers, and supervisors can view alerts
  @Get()
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async getAlerts(
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: UserPayload,
  ) {
    // TenantGuard ensures user has access to warehouseId
    // ...
  }

  // Only supervisors+ can acknowledge
  @Post(':id/acknowledge')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async acknowledgeAlert(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    // userId is auto-extracted from JWT
  }

  // Only admins and safety officers can create rules
  @Post('rules')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  async createRule(@Body() dto: CreateRuleDto) {
    // ...
  }
}
```

---

## Database Schema

### Users & Roles
```sql
-- Core user table
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Many-to-many: user <-> roles
user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role ENUM('ADMIN', 'SAFETY_OFFICER', 'SUPERVISOR', 'OPERATOR'),
  created_at TIMESTAMP
)

-- Tenant isolation: user <-> warehouses
user_warehouses (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  created_at TIMESTAMP,
  UNIQUE(user_id, warehouse_id)
)

-- Tenant isolation: user <-> zones
user_zones (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMP,
  UNIQUE(user_id, zone_id)
)

-- Refresh token storage
refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  revoked_at TIMESTAMP
)
```

---

## Frontend Integration

### AuthContext Usage

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, hasRole, logout } = useAuth();

  if (hasRole(Role.ADMIN)) {
    // Show admin UI
  }

  return <button onClick={logout}>Logout</button>;
}
```

### Protected Routes

```typescript
import { withAuth } from '@/contexts/AuthContext';
import { Role } from '@/contexts/AuthContext';

function AdminDashboard() {
  return <div>Admin Only</div>;
}

export default withAuth(AdminDashboard, [Role.ADMIN]);
```

### API Calls with Auth

```typescript
import { useApi } from '@/hooks/useApi';

function AlertsList() {
  const { get } = useApi();

  useEffect(() => {
    get('/alerts?warehouseId=123').then(data => {
      // Token automatically included
    });
  }, []);
}
```

---

## Security Best Practices

### ✅ Implemented
- [x] JWT access tokens with short expiry
- [x] Refresh token rotation
- [x] Password hashing (bcrypt, 10 rounds)
- [x] Role-based access control
- [x] Tenant isolation (warehouse/zone)
- [x] Rate limiting on login (10 req/min)
- [x] Token revocation on logout
- [x] Auto-refresh before expiry

### ⚠️ Production Recommendations
- [ ] Upgrade to RS256 with key rotation
- [ ] Store tokens in httpOnly cookies (not localStorage)
- [ ] Add CSRF protection
- [ ] Implement account lockout after failed attempts
- [ ] Add 2FA for admin accounts
- [ ] Enable audit logging for security events
- [ ] Add IP whitelisting for admin routes
- [ ] Implement session management (force logout)

---

## Environment Variables

```bash
# Backend (.env)
JWT_SECRET=your-super-secret-key-change-this-in-production
DATABASE_URL=postgresql://user:pass@localhost:5432/smartpick

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Migration Commands

```bash
# Backend
cd backend
npm run prisma:generate
npm run migrate:dev

# Frontend
cd frontend
npm install js-cookie @types/js-cookie
```

---

## Testing Credentials (Seed Data)

After migration, create users with:

```typescript
// Run in backend/src/scripts/seed-users.ts
const password = await authService.hashPassword('password123');

await prisma.user.create({
  data: {
    email: 'admin@smartpick.com',
    passwordHash: password,
    firstName: 'Admin',
    lastName: 'User',
    roles: { create: { role: Role.ADMIN } },
  },
});

await prisma.user.create({
  data: {
    email: 'safety@smartpick.com',
    passwordHash: password,
    firstName: 'Safety',
    lastName: 'Officer',
    roles: { create: { role: Role.SAFETY_OFFICER } },
  },
});
```

---

## API Endpoints

### Public Endpoints
- `POST /auth/login` - Rate limited (10/min)
- `POST /auth/refresh`

### Protected Endpoints
- `GET /auth/me` - Get current user profile
- `POST /auth/logout` - Revoke refresh tokens

### Rate Limiting
- Login: 10 requests/minute
- General: 100 requests/minute (global throttler)
