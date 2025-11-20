import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';

export enum WeightClass {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  VERY_HEAVY = 'very_heavy',
}

export enum EquipmentType {
  NONE = 'none',
  STEPLADDER = 'stepladder',
  FORKLIFT = 'forklift',
  PALLET_JACK = 'pallet_jack',
  ORDER_PICKER = 'order_picker',
}

export class SkuConstraintsDto {
  @IsString()
  skuId: string;

  @IsEnum(WeightClass)
  weightClass: WeightClass;

  @IsNumber()
  @Min(0)
  stackLimit: number;

  @IsArray()
  @IsEnum(EquipmentType, { each: true })
  equipmentNeeded: EquipmentType[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minTemperatureCelsius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTemperatureCelsius?: number;

  @IsOptional()
  @IsString()
  hazmatClass?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incompatibleWith?: string[];
}

export class UpdateSkuConstraintsDto {
  @IsOptional()
  @IsEnum(WeightClass)
  weightClass?: WeightClass;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stackLimit?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(EquipmentType, { each: true })
  equipmentNeeded?: EquipmentType[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minTemperatureCelsius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTemperatureCelsius?: number;

  @IsOptional()
  @IsString()
  hazmatClass?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incompatibleWith?: string[];
}
