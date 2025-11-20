import { Module } from '@nestjs/common';
import { ErgonomicsWorker } from './ergonomics.worker';
import { CommonModule } from '../common/common.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [CommonModule, WebsocketModule],
  providers: [ErgonomicsWorker],
  exports: [ErgonomicsWorker],
})
export class WorkersModule {}
