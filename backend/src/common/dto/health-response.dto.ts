import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: '2025-11-17T15:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({
    description: 'Status of connected services',
    example: {
      database: 'unavailable',
      redis: 'unavailable',
    },
  })
  services!: {
    database: string;
    redis: string;
  };
}
