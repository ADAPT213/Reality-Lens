import { Controller, Get } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

@Controller('health/websocket')
export class WebsocketHealthController {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  @Get('metrics')
  getMetrics() {
    return this.websocketGateway.getMetrics();
  }

  @Get()
  check() {
    const metrics = this.websocketGateway.getMetrics();
    return {
      status: 'healthy',
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }
}
