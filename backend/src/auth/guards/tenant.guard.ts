import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../roles.enum';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';
import { UserPayload } from '../dto/user-payload.dto';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserPayload = request.user;

    if (!user) {
      return false;
    }

    if (user.roles.includes(Role.ADMIN)) {
      return true;
    }

    const warehouseId =
      request.params.warehouseId || request.query.warehouseId || request.body?.warehouseId;

    const zoneId = request.params.zoneId || request.query.zoneId || request.body?.zoneId;

    if (warehouseId && !user.warehouseIds.includes(warehouseId)) {
      throw new ForbiddenException('Access denied to this warehouse');
    }

    if (zoneId && !user.zoneIds.includes(zoneId)) {
      throw new ForbiddenException('Access denied to this zone');
    }

    return true;
  }
}
