import { ApiProperty } from '@nestjs/swagger';

export class MoveReceiptDto {
  @ApiProperty() skuId!: string;
  @ApiProperty() fromLocationId!: string;
  @ApiProperty() toLocationId!: string;
  @ApiProperty() expectedSecondsSavedPerPick!: number;
  @ApiProperty() expectedRiskReduction!: number;
  @ApiProperty({ description: 'Breakdown terms' }) F!: number;
  @ApiProperty() T!: number;
  @ApiProperty() E!: number;
  @ApiProperty() C!: number;
  @ApiProperty() R!: number;
  @ApiProperty() scoreBefore!: number;
  @ApiProperty() scoreAfter!: number;
  @ApiProperty() rationale!: string;
}

export class MovePlanItemDto extends MoveReceiptDto {
  @ApiProperty() priority!: number;
}

export class MovePlanResponseDto {
  @ApiProperty({ type: [MovePlanItemDto] }) items!: MovePlanItemDto[];
  @ApiProperty() generatedAt!: string;
}
