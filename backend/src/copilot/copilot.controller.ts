import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CopilotService } from './copilot.service';
import { AskDto } from './dto/ask.dto';
import { CopilotResponseDto } from './dto/copilot-response.dto';
import { ClarityEventsService } from '../clarity/events.service';

@ApiTags('copilot')
@Controller('copilot')
export class CopilotController {
  constructor(
    private copilotService: CopilotService,
    private clarityEvents: ClarityEventsService,
  ) {}

  @Post('ask')
  @ApiOperation({ summary: 'Ask Copilot for operational guidance' })
  @ApiResponse({
    status: 200,
    description: 'Copilot response',
    type: CopilotResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async ask(@Body() dto: AskDto): Promise<CopilotResponseDto> {
    await this.clarityEvents.logEvent({
      context: 'copilot',
      source: 'user',
      type: 'copilot_question',
      payload: { question: dto.question },
    });
    try {
      const answer = await this.copilotService.askCopilot(
        dto.question,
        dto.warehouseId,
        dto.shiftCode,
      );
      await this.clarityEvents.logEvent({
        context: 'copilot',
        source: 'system',
        type: 'copilot_guidance_returned',
        payload: { question: dto.question, answerLength: answer?.length || 0 },
      });
      return { answer };
    } catch (e: any) {
      return {
        answer: 'SmartPick Copilot (local mode) — request handled with fallback.',
        error: e?.message || 'unknown',
      };
    }
  }

  @Post('ask/stream')
  @ApiOperation({ summary: 'Stream Copilot response (SSE)' })
  @ApiResponse({ status: 200, description: 'Event stream started' })
  async askStream(@Body() dto: AskDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    try {
      const answer = await this.copilotService.askCopilot(
        dto.question,
        dto.warehouseId,
        dto.shiftCode,
      );
      const lines = answer.split('\n');
      for (const line of lines) {
        res.write(`event: chunk\n`);
        res.write(`data: ${line.replace(/\r/g, '')}\n\n`);
      }
      res.write('event: done\n');
      res.write('data: end\n\n');
      res.end();
    } catch (e: any) {
      res.write('event: error\n');
      res.write(`data: ${e?.message || 'unknown'}\n\n`);
      res.end();
    }
  }
}
