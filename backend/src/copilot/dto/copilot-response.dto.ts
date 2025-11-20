import { ApiProperty } from '@nestjs/swagger';

export class CopilotResponseDto {
  @ApiProperty({
    description: 'Response from Copilot assistant',
    example: 'Based on current metrics, Zone A requires attention due to elevated red locations.',
  })
  answer!: string;

  @ApiProperty({
    description: 'Optional error message if fallback mode',
    required: false,
  })
  error?: string;
}
