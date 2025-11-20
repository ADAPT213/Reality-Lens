import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';

export enum ErgonomicBand {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red',
}

export class LocationPropertiesDto {
  @IsString()
  locationId: string;

  @IsString()
  aisle: string;

  @IsString()
  bay: string;

  @IsString()
  level: string;

  @IsEnum(ErgonomicBand)
  ergonomicBand: ErgonomicBand;

  @IsNumber()
  @Min(0)
  distanceFromDock: number;

  @IsNumber()
  @Min(0)
  distanceFromMainPath: number;

  @IsNumber()
  @Min(0)
  @Max(300)
  heightCm: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  accessibilityScore?: number;
}

export class UpdateLocationPropertiesDto {
  @IsOptional()
  @IsEnum(ErgonomicBand)
  ergonomicBand?: ErgonomicBand;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceFromDock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceFromMainPath?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  accessibilityScore?: number;
}
