import { ApiProperty } from '@nestjs/swagger';

export class HeatTileDto {
  @ApiProperty() locationId!: string;
  @ApiProperty() zoneId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ description: 'travel cost proxy' }) travelCost!: number;
  @ApiProperty({ description: 'pick frequency' }) frequency!: number;
  @ApiProperty({ description: 'ergonomic penalty' }) ergoPenalty!: number;
  @ApiProperty({ description: 'congestion penalty' }) congestion!: number;
  @ApiProperty() reachBand!: string | null;
}

export class HeatmapResponseDto {
  @ApiProperty({ type: [HeatTileDto] }) tiles!: HeatTileDto[];
  @ApiProperty() generatedAt!: string;
}
