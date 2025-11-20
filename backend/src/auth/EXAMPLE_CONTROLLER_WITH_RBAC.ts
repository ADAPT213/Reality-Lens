import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { RequireTenant } from './decorators/require-tenant.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Role } from './roles.enum';
import { UserPayload } from './dto/user-payload.dto';

@Controller('alerts')
@RequireTenant()
export class AlertsControllerExample {
  @Get()
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async findAll(@CurrentUser() user: UserPayload, @Query('warehouseId') warehouseId?: string) {
    return { message: 'View all alerts', user, warehouseId };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return { message: 'View alert', user, id };
  }

  @Post()
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  async create(@CurrentUser() user: UserPayload, @Body() createDto: any) {
    return { message: 'Create alert rule', user, createDto };
  }

  @Patch(':id/acknowledge')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  async acknowledge(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return { message: 'Acknowledge alert', user, id };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return { message: 'Delete alert', user, id };
  }

  @Get('metrics/own')
  @Roles(Role.OPERATOR)
  async getOwnMetrics(@CurrentUser() user: UserPayload) {
    return { message: 'View own metrics', userId: user.userId };
  }
}
