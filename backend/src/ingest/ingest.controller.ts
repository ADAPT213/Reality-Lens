import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClarityEventsService } from '../clarity/events.service';

@ApiTags('ingest')
@Controller({ path: 'ingest', version: '1' })
export class IngestController {
  constructor(private clarityEvents: ClarityEventsService) {}

  private ordersBuffer: any[] = [];
  private telemetryBuffer: any[] = [];

  @Post('orders')
  @ApiOperation({ summary: 'Ingest order events (batch or single)' })
  @ApiResponse({ status: 202, description: 'Accepted' })
  async acceptOrders(@Body() body: any) {
    const items = Array.isArray(body) ? body : [body];
    items.forEach((i) => this.ordersBuffer.push({ ...i, receivedAt: new Date().toISOString() }));
    await this.clarityEvents.logEvent({
      context: 'upload',
      source: 'user',
      type: 'warehouse_data_uploaded',
      payload: { kind: 'orders', rows: items.length },
    });
    return { status: 'accepted', count: items.length };
  }

  @Post('telemetry')
  @ApiOperation({ summary: 'Ingest live telemetry (picks/hour, congestion, mispicks)' })
  @ApiResponse({ status: 202, description: 'Accepted' })
  acceptTelemetry(@Body() body: any) {
    const items = Array.isArray(body) ? body : [body];
    items.forEach((i) => this.telemetryBuffer.push({ ...i, receivedAt: new Date().toISOString() }));
    return { status: 'accepted', count: items.length };
  }
}
