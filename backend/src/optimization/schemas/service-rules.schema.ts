import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class ClientPriorityRule {
  @IsString()
  clientId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;

  @IsOptional()
  @IsString()
  cutOffTime?: string;
}

export class SkuFamilyRule {
  @IsString()
  familyId: string;

  @IsArray()
  @IsString({ each: true })
  skuIds: string[];

  @IsBoolean()
  colocate: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDistanceMeters?: number;
}

export class LaneAffinityRule {
  @IsString()
  laneId: string;

  @IsArray()
  @IsString({ each: true })
  preferredZones: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  affinityBonus: number;
}

export class ServiceRulesDto {
  @IsString()
  warehouseId: string;

  @IsArray()
  clientPriorities: ClientPriorityRule[];

  @IsArray()
  skuFamilies: SkuFamilyRule[];

  @IsArray()
  laneAffinities: LaneAffinityRule[];
}

export class UpdateServiceRulesDto {
  @IsOptional()
  @IsArray()
  clientPriorities?: ClientPriorityRule[];

  @IsOptional()
  @IsArray()
  skuFamilies?: SkuFamilyRule[];

  @IsOptional()
  @IsArray()
  laneAffinities?: LaneAffinityRule[];
}
