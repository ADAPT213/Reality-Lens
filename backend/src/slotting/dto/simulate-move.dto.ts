import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SimulateMoveDto {
  @ApiProperty() @IsString() @IsNotEmpty() skuId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() targetLocationId!: string;
}

export class SimulateMoveResponseDto {
  @ApiProperty() deltaSecondsPerPick!: number;
  @ApiProperty() deltaRisk!: number;
  @ApiProperty() scoreBefore!: number;
  @ApiProperty() scoreAfter!: number;
  @ApiProperty() F!: number;
  @ApiProperty() T!: number;
  @ApiProperty() E!: number;
  @ApiProperty() C!: number;
  @ApiProperty() R!: number;
  @ApiProperty() rationale!: string;
}
