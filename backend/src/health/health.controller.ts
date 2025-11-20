import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { CopilotService } from '../copilot/copilot.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly copilot: CopilotService) {}
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    const keyStats = this.copilot.getKeyStats();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        database: process.env.DATABASE_URL ? 'available' : 'unavailable',
        redis: process.env.REDIS_URL ? 'available' : 'unavailable',
      },
      commit: process.env.GIT_COMMIT || 'unknown',
      keyStats,
    };
  }
}
