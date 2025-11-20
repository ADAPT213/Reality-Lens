import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { ErgonomicSnapshotEvent, ErgonomicSnapshotEventSchema } from '../schemas/events.schema';

@Injectable()
export class StreamProducerService {
  private readonly logger = new Logger(StreamProducerService.name);
  private readonly STREAM_NAME = 'ergonomics:events';
  private readonly MAX_STREAM_LENGTH = 10000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(private readonly redisService: RedisService) {}

  async publishErgonomicEvent(
    event: ErgonomicSnapshotEvent,
    idempotencyKey?: string,
  ): Promise<string | null> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) {
      this.logger.warn('Redis unavailable, cannot publish event');
      return null;
    }

    try {
      const validatedEvent = ErgonomicSnapshotEventSchema.parse(event);
      const key = idempotencyKey || event.event_id;

      if (await this.isDuplicate(key)) {
        this.logger.debug(`Duplicate event detected: ${key}`);
        return null;
      }

      const eventId = await this.publishWithRetry(validatedEvent, key);

      if (eventId) {
        await this.markAsProcessed(key);
        this.logger.debug(`Published event ${event.event_id} to stream ${this.STREAM_NAME}`);
      }

      return eventId;
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async publishWithRetry(
    event: ErgonomicSnapshotEvent,
    idempotencyKey: string,
  ): Promise<string | null> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) return null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const eventId = await publisher.xadd(
          this.STREAM_NAME,
          'MAXLEN',
          '~',
          this.MAX_STREAM_LENGTH,
          '*',
          'event_id',
          event.event_id,
          'event_time',
          event.event_time,
          'ingest_time',
          event.ingest_time,
          'warehouse_id',
          event.warehouse_id,
          'zone_id',
          event.zone_id,
          'camera_id',
          event.camera_id,
          'worker_id',
          event.worker_id || '',
          'model_version',
          event.model_version,
          'risk_score',
          event.risk_score.toString(),
          'posture_keypoints',
          JSON.stringify(event.posture_keypoints),
          'confidence',
          event.confidence.toString(),
          'source',
          event.source,
          'idempotency_key',
          idempotencyKey,
        );

        return eventId;
      } catch (error) {
        this.logger.warn(`Publish attempt ${attempt}/${this.MAX_RETRIES} failed: ${error.message}`);

        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  private async isDuplicate(idempotencyKey: string): Promise<boolean> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) return false;

    try {
      const exists = await publisher.exists(`idempotency:${idempotencyKey}`);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check idempotency: ${error.message}`);
      return false;
    }
  }

  private async markAsProcessed(idempotencyKey: string): Promise<void> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) return;

    try {
      await publisher.setex(`idempotency:${idempotencyKey}`, 86400, '1');
    } catch (error) {
      this.logger.error(`Failed to mark as processed: ${error.message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getStreamInfo(): Promise<any> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) return null;

    try {
      const info = await publisher.xinfo('STREAM', this.STREAM_NAME);
      return info;
    } catch (error) {
      this.logger.error(`Failed to get stream info: ${error.message}`);
      return null;
    }
  }

  async getStreamLength(): Promise<number> {
    const publisher = this.redisService.getPublisher();
    if (!publisher) return 0;

    try {
      const length = await publisher.xlen(this.STREAM_NAME);
      return length;
    } catch (error) {
      this.logger.error(`Failed to get stream length: ${error.message}`);
      return 0;
    }
  }
}
