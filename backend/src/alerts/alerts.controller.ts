import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateRuleDto, UpdateAlertDto, GetAlertsQueryDto } from './dto/alerts.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireTenant } from '../auth/decorators/require-tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../auth/roles.enum';
import { UserPayload } from '../auth/dto/user-payload.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
@RequireTenant()
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Get paginated alerts with filters' })
  async getAlerts(@Query() query: GetAlertsQueryDto, @CurrentUser() user: UserPayload) {
    return this.alertsService.getAlerts(query);
  }

  @Post(':id/acknowledge')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() body: UpdateAlertDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.alertsService.acknowledgeAlert(id, userId);
  }

  @Post(':id/snooze')
  @ApiOperation({ summary: 'Snooze an alert' })
  async snoozeAlert(@Param('id') id: string, @Body() body: { minutes: number }) {
    return this.alertsService.snoozeAlert(id, body.minutes);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  async resolveAlert(@Param('id') id: string) {
    return this.alertsService.resolveAlert(id);
  }

  @Get('rules')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  @ApiOperation({ summary: 'Get all alert rules' })
  async getRules() {
    return this.alertsService.getRules();
  }

  @Post('rules')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  @ApiOperation({ summary: 'Create a new alert rule' })
  async createRule(@Body() dto: CreateRuleDto) {
    return this.alertsService.createRule(dto);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get a specific rule' })
  async getRule(@Param('id') id: string) {
    return this.alertsService.getRule(id);
  }

  @Post('rules/:id')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  @ApiOperation({ summary: 'Update an alert rule' })
  async updateRule(@Param('id') id: string, @Body() dto: CreateRuleDto) {
    return this.alertsService.updateRule(id, dto);
  }

  @Post('rules/:id/toggle')
  @Roles(Role.ADMIN, Role.SAFETY_OFFICER)
  @ApiOperation({ summary: 'Enable/disable a rule' })
  async toggleRule(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.alertsService.toggleRule(id, body.enabled);
  }

  @Get('simulate')
  @ApiOperation({ summary: 'Simulate alerts with hypothetical thresholds' })
  async simulate(@Query() query: { minutes: number; ruleId?: string }) {
    return this.alertsService.simulate(query.minutes, query.ruleId);
  }
}
