import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { MovePlannerService } from './move-planner.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface CompleteMovePlanDto {
  actualTravelTimeSaved?: number;
  actualPickTimeSaved?: number;
  actualErgonomicImprovement?: number;
  notes?: string;
}

@ApiTags('Replen')
@Controller('replen')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReplenController {
  constructor(private movePlannerService: MovePlannerService) {}

  @Get('tonight-moves/:warehouseId')
  @ApiOperation({
    summary: "Get tonight's prioritized move recommendations",
    description: 'Returns nightly move plan sorted by ROI (high impact, low effort first)',
  })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'List of prioritized moves for tonight',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          priorityRank: { type: 'number' },
          skuCode: { type: 'string' },
          fromLocationLabel: { type: 'string' },
          toLocationLabel: { type: 'string' },
          effortMinutes: { type: 'number' },
          expectedGain: { type: 'object' },
          reasoning: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  })
  async getTonightMoves(@Param('warehouseId') warehouseId: string) {
    return this.movePlannerService.generateNightlyPlan(warehouseId);
  }

  @Get('live-suggestions/:warehouseId')
  @ApiOperation({
    summary: 'Get live in-shift spike suggestions',
    description: 'Returns emergency move recommendations for current spikes',
  })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'List of live spike-driven move suggestions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          alert: { type: 'object' },
          move: { type: 'object' },
          roi: { type: 'number' },
        },
      },
    },
  })
  async getLiveSuggestions(@Param('warehouseId') warehouseId: string) {
    return this.movePlannerService.getLiveSuggestions(warehouseId);
  }

  @Post('moves/:moveId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a move as completed',
    description: 'Records actual impact metrics and calculates prediction accuracy',
  })
  @ApiParam({ name: 'moveId', description: 'Move Plan ID', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        actualTravelTimeSaved: { type: 'number', description: 'Actual seconds saved on travel' },
        actualPickTimeSaved: { type: 'number', description: 'Actual seconds saved on pick time' },
        actualErgonomicImprovement: { type: 'number', description: 'Ergonomic score improvement' },
        notes: { type: 'string', description: 'Optional notes from the operator' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Move marked as completed',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['COMPLETED'] },
        completedAt: { type: 'string', format: 'date-time' },
        completedBy: { type: 'string' },
        actualImpact: { type: 'object' },
      },
    },
  })
  async completeMove(
    @Param('moveId') moveId: string,
    @Body() data: CompleteMovePlanDto,
    @CurrentUser() user: any,
  ) {
    return this.movePlannerService.completeMoveById(moveId, user.userId, data);
  }

  @Get('impact-summary/:warehouseId')
  @ApiOperation({
    summary: 'Get impact summary for last 30 days',
    description: 'Returns aggregate metrics on completed moves and prediction accuracy',
  })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Impact summary statistics',
    schema: {
      type: 'object',
      properties: {
        totalMovesCompleted: { type: 'number' },
        avgPredictedSecondsSaved: { type: 'number' },
        avgActualSecondsSaved: { type: 'number' },
        predictionAccuracy: {
          type: 'object',
          properties: {
            mae: { type: 'number', description: 'Mean Absolute Error' },
            rmse: { type: 'number', description: 'Root Mean Square Error' },
            percentageError: { type: 'number', description: 'Percentage error' },
          },
        },
        totalErgonomicRiskReduced: { type: 'number' },
        roiDistribution: {
          type: 'object',
          properties: {
            high: { type: 'number' },
            medium: { type: 'number' },
            low: { type: 'number' },
          },
        },
        last30Days: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getImpactSummary(@Param('warehouseId') warehouseId: string) {
    return this.movePlannerService.getImpactSummary(warehouseId);
  }
}
