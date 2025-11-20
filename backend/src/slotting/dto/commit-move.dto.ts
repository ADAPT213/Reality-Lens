import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CommitMoveDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  skuId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fromLocationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toLocationId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  windowStart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  windowEnd?: string;
}
