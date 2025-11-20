import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AskDto {
  @ApiProperty({
    description: 'Question to ask the Copilot assistant',
    example: 'Which zone should we fix next?',
  })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiPropertyOptional({
    description: 'Optional warehouse ID for context',
    example: 'wh-001',
  })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Optional shift code for context',
    example: 'A',
  })
  @IsString()
  @IsOptional()
  shiftCode?: string;

  @ApiPropertyOptional({
    description: 'Override model name for this request (provider-specific)',
    example: 'gpt-4o-mini',
  })
  @IsString()
  @IsOptional()
  model?: string;
}
