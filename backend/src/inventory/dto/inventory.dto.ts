import { IsString, IsArray, ValidateNested, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProposedMoveDto {
  @ApiProperty({ example: 'SKU-12345' })
  @IsString()
  skuCode!: string;

  @ApiProperty({ example: 'uuid' })
  @IsString()
  fromLocationId!: string;

  @ApiProperty({ example: 'uuid' })
  @IsString()
  toLocationId!: string;
}

export class SimulateScenarioDto {
  @ApiProperty({ type: [ProposedMoveDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposedMoveDto)
  moves!: ProposedMoveDto[];
}

export class GetAlertsQueryDto {
  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
