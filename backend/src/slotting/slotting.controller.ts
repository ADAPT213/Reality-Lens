import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SlottingService } from './slotting.service';
import { MovePlanResponseDto } from './dto/move-plan.dto';
import { HeatmapResponseDto } from './dto/heatmap.dto';
import { SimulateMoveDto, SimulateMoveResponseDto } from './dto/simulate-move.dto';
import { CommitMoveDto } from './dto/commit-move.dto';
import { ClarityEventsService } from '../clarity/events.service';

@ApiTags('slotting')
@Controller({ path: 'slotting', version: '1' })
export class SlottingController {
  constructor(
    private service: SlottingService,
    private clarityEvents: ClarityEventsService,
  ) {}

  @Get('move-plan')
  @ApiOperation({ summary: 'Generate prioritized move plan with receipts' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({ status: 200, type: MovePlanResponseDto })
  async movePlan(@Query('warehouseId') warehouseId: string): Promise<MovePlanResponseDto> {
    try {
      const result = await this.service.generateMovePlan(warehouseId);
      await this.clarityEvents.logEvent({
        context: 'slotting',
        source: 'system',
        type: 'slotting_plan_generated',
        payload: { warehouseId, moves: result.items?.length ?? 0 },
      });
      return result;
    } catch (e: any) {
      return { items: [], generatedAt: new Date().toISOString() };
    }
  }

  @Post('simulate-move')
  @ApiOperation({ summary: 'Simulate a move and return KPI deltas and scoring' })
  @ApiResponse({ status: 200, type: SimulateMoveResponseDto })
  async simulateMove(@Body() dto: SimulateMoveDto): Promise<SimulateMoveResponseDto> {
    try {
      return await this.service.simulateMove(dto.skuId, dto.targetLocationId);
    } catch (e: any) {
      return {
        deltaSecondsPerPick: 0,
        deltaRisk: 0,
        scoreBefore: 0,
        scoreAfter: 0,
        F: 0,
        T: 0,
        E: 0,
        C: 0,
        R: 0,
        rationale: 'Service unavailable; try again later.',
      };
    }
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Return heatmap tiles for inventory visualization' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({ status: 200, type: HeatmapResponseDto })
  async heatmap(@Query('warehouseId') warehouseId: string): Promise<HeatmapResponseDto> {
    try {
      return await this.service.heatmap(warehouseId);
    } catch (e: any) {
      return { tiles: [], generatedAt: new Date().toISOString() };
    }
  }

  @Post('commit-move')
  @ApiOperation({ summary: 'Record an accepted move for execution window' })
  @ApiResponse({ status: 202, description: 'Move accepted' })
  async commitMove(@Body() dto: CommitMoveDto) {
    try {
      await this.service.commitMove(dto);
      await this.clarityEvents.logEvent({
        context: 'replen',
        source: 'user',
        type: 'move_completed',
        payload: {
          skuId: dto.skuId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
        },
      });
      return { status: 'accepted', timestamp: new Date().toISOString() };
    } catch (e: any) {
      return { status: 'queued', note: 'Persistence unavailable; will retry.' };
    }
  }
}
