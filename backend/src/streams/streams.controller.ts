import { Controller, Get } from '@nestjs/common';
import { StreamProducerService } from './producer.service';
import { ErgonomicsWorker } from '../workers/ergonomics.worker';

@Controller('streams')
export class StreamsController {
  constructor(
    private readonly producerService: StreamProducerService,
    private readonly ergonomicsWorker: ErgonomicsWorker,
  ) {}

  @Get('health')
  async getHealth() {
    const streamInfo = await this.producerService.getStreamInfo();
    const streamLength = await this.producerService.getStreamLength();
    const workerStats = await this.ergonomicsWorker.getWorkerStats();

    return {
      status: streamInfo ? 'healthy' : 'degraded',
      stream: {
        name: 'ergonomics:events',
        length: streamLength,
        info: streamInfo,
      },
      worker: workerStats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  async getStats() {
    const streamLength = await this.producerService.getStreamLength();
    const workerStats = await this.ergonomicsWorker.getWorkerStats();

    return {
      stream: {
        length: streamLength,
      },
      worker: workerStats,
    };
  }
}
