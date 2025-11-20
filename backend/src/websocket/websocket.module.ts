import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { ConnectionManagerService } from './connection-manager.service';
import { WebsocketHealthController } from './websocket-health.controller';

@Module({
  controllers: [WebsocketHealthController],
  providers: [WebsocketGateway, ConnectionManagerService],
  exports: [WebsocketGateway, ConnectionManagerService],
})
export class WebsocketModule {}
