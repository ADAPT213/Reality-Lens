import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AlertPriority,
  AlertOperator,
  AlertChannel,
  RuleCondition,
  ChannelConfig,
  AlertState,
} from '../schemas/rule.schema';

export class CreateRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  enabled: boolean;

  @IsEnum(AlertPriority)
  priority: AlertPriority;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @IsOptional()
  @IsObject()
  hysteresis?: {
    onThreshold: number;
    offThreshold: number;
  };

  @IsOptional()
  @IsNumber()
  cooldownMinutes?: number;

  @IsOptional()
  @IsObject()
  rateLimit?: {
    maxAlerts: number;
    windowMinutes: number;
  };

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelConfigDto)
  channels: ChannelConfigDto[];

  @IsOptional()
  @IsObject()
  scope?: {
    warehouseIds?: string[];
    zoneIds?: string[];
    shiftCodes?: string[];
  };
}

export class RuleConditionDto implements RuleCondition {
  @IsString()
  field: string;

  @IsEnum(AlertOperator)
  operator: AlertOperator;

  @IsNumber()
  threshold: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;
}

export class ChannelConfigDto implements ChannelConfig {
  @IsEnum(AlertChannel)
  channel: AlertChannel;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsObject()
  config?: {
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
    retries?: number;
  };
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

export class GetAlertsQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(AlertState)
  state?: AlertState;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  shiftCode?: string;

  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;
}
