import { ApiProperty } from '@nestjs/swagger';

class HealthServicesDto {
  @ApiProperty() database!: string;
  @ApiProperty() redis!: string;
}

class KeyStatDto {
  @ApiProperty() index!: number;
  @ApiProperty() successes!: number;
  @ApiProperty() failures!: number;
}

class KeyStatsDto {
  @ApiProperty({ type: [KeyStatDto] }) openai!: KeyStatDto[];
  @ApiProperty({ type: [KeyStatDto] }) openrouter!: KeyStatDto[];
  @ApiProperty() uptimeSeconds!: number;
  @ApiProperty() provider!: string;
  @ApiProperty() model!: string;
}

export class HealthResponseDto {
  @ApiProperty() status!: string;
  @ApiProperty() timestamp!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ type: HealthServicesDto }) services!: HealthServicesDto;
  @ApiProperty() commit!: string;
  @ApiProperty({ type: KeyStatsDto }) keyStats!: KeyStatsDto;
}
