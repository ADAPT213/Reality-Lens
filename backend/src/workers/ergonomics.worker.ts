import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { RedisService } from '../common/redis.service';
import { PrismaService } from '../common/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ErgonomicSnapshotEventSchema, ShiftSnapshotEvent } from '../schemas/events.schema';

interface ErgonomicEventJob {
  eventId: string;
  eventData: Record<string, string>;
  streamId: string;
}

@Injectable()
export class ErgonomicsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErgonomicsWorker.name);
  private worker: Worker | null = null;
  private redisClient: Redis | null = null;
  private readonly STREAM_NAME = 'ergonomics:events';
  private readonly CONSUMER_GROUP = 'ergonomics-processor';
  private readonly CONSUMER_NAME = `consumer-${process.pid}`;
  private processedKeys = new Set<string>();
  private readonly MAX_PROCESSED_KEYS = 10000;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      await this.ensureConsumerGroup();
      await this.startWorker();

      this.logger.log('Ergonomics worker initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize worker: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Worker closed');
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected');
    }
  }

  private async ensureConsumerGroup() {
    if (!this.redisClient) return;

    try {
      await this.redisClient.xgroup(
        'CREATE',
        this.STREAM_NAME,
        this.CONSUMER_GROUP,
        '0',
        'MKSTREAM',
      );
      this.logger.log(`Consumer group '${this.CONSUMER_GROUP}' created`);
    } catch (error) {
      if (error.message.includes('BUSYGROUP')) {
        this.logger.debug(`Consumer group '${this.CONSUMER_GROUP}' already exists`);
      } else {
        throw error;
      }
    }
  }

  private async startWorker() {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available, worker not started');
      return;
    }

    this.logger.log('Starting stream consumer...');

    const pollInterval = setInterval(async () => {
      try {
        await this.processStreamMessages();
      } catch (error) {
        this.logger.error(`Error processing stream: ${error.message}`, error.stack);
      }
    }, 100);

    this.worker = {
      close: async () => {
        clearInterval(pollInterval);
      },
    } as any;
  }

  private async processStreamMessages() {
    if (!this.redisClient) return;

    try {
      const results = await this.redisClient.xreadgroup(
        'GROUP',
        this.CONSUMER_GROUP,
        this.CONSUMER_NAME,
        'BLOCK',
        1000,
        'COUNT',
        10,
        'STREAMS',
        this.STREAM_NAME,
        '>',
      );

      if (!results || results.length === 0) return;

      for (const [_stream, messages] of results) {
        for (const [streamId, fields] of messages) {
          await this.processMessage(streamId, fields);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read from stream: ${error.message}`);
    }
  }

  private async processMessage(streamId: string, fields: string[]) {
    if (!this.redisClient) return;

    try {
      const eventData = this.parseFields(fields);
      const idempotencyKey = eventData.idempotency_key || eventData.event_id;

      if (await this.isDuplicate(idempotencyKey)) {
        this.logger.debug(`Skipping duplicate message: ${idempotencyKey}`);
        await this.redisClient.xack(this.STREAM_NAME, this.CONSUMER_GROUP, streamId);
        return;
      }

      const event = this.parseEvent(eventData);
      const validatedEvent = ErgonomicSnapshotEventSchema.parse(event);

      await this.persistEvent(validatedEvent);
      await this.broadcastEvent(validatedEvent);

      this.markAsProcessed(idempotencyKey);

      await this.redisClient.xack(this.STREAM_NAME, this.CONSUMER_GROUP, streamId);

      this.logger.debug(`Processed event ${validatedEvent.event_id}`);
    } catch (error) {
      this.logger.error(`Failed to process message ${streamId}: ${error.message}`, error.stack);
    }
  }

  private parseFields(fields: string[]): Record<string, string> {
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return data;
  }

  private parseEvent(data: Record<string, string>) {
    return {
      event_id: data.event_id,
      event_time: data.event_time,
      ingest_time: data.ingest_time,
      warehouse_id: data.warehouse_id,
      zone_id: data.zone_id,
      camera_id: data.camera_id,
      worker_id: data.worker_id || null,
      model_version: data.model_version,
      risk_score: parseFloat(data.risk_score),
      posture_keypoints: JSON.parse(data.posture_keypoints),
      confidence: parseFloat(data.confidence),
      source: data.source,
    };
  }

  private async isDuplicate(idempotencyKey: string): Promise<boolean> {
    if (this.processedKeys.has(idempotencyKey)) {
      return true;
    }

    const publisher = this.redisService.getPublisher();
    if (!publisher) return false;

    try {
      const exists = await publisher.exists(`processed:${idempotencyKey}`);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check duplicate: ${error.message}`);
      return false;
    }
  }

  private markAsProcessed(idempotencyKey: string) {
    this.processedKeys.add(idempotencyKey);

    if (this.processedKeys.size > this.MAX_PROCESSED_KEYS) {
      const firstKey = this.processedKeys.values().next().value;
      this.processedKeys.delete(firstKey);
    }

    const publisher = this.redisService.getPublisher();
    if (publisher) {
      publisher.setex(`processed:${idempotencyKey}`, 86400, '1').catch((err) => {
        this.logger.error(`Failed to mark as processed in Redis: ${err.message}`);
      });
    }
  }

  private async persistEvent(event: any) {
    try {
      await this.prisma.ergonomicSnapshot.create({
        data: {
          id: event.event_id,
          eventTime: new Date(event.event_time),
          ingestTime: new Date(event.ingest_time),
          warehouseId: event.warehouse_id,
          zoneId: event.zone_id,
          cameraId: event.camera_id,
          workerId: event.worker_id,
          modelVersion: event.model_version,
          riskScore: event.risk_score,
          postureKeypoints: event.posture_keypoints,
          confidence: event.confidence,
          source: event.source,
        },
      });

      this.logger.debug(`Persisted event ${event.event_id} to database`);
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.debug(`Event ${event.event_id} already exists in database`);
      } else {
        throw error;
      }
    }
  }

  private async broadcastEvent(event: any) {
    try {
      const shiftSnapshot: ShiftSnapshotEvent = {
        event_id: event.event_id,
        event_time: event.event_time,
        warehouse_id: event.warehouse_id,
        zone_id: event.zone_id,
        worker_id: event.worker_id,
        risk_score: event.risk_score,
        confidence: event.confidence,
      };

      this.websocketGateway.broadcast('ergonomic:snapshot', shiftSnapshot);

      this.logger.debug(`Broadcasted event ${event.event_id} to WebSocket clients`);
    } catch (error) {
      this.logger.error(`Failed to broadcast event: ${error.message}`);
    }
  }

  async getWorkerStats() {
    if (!this.redisClient) {
      return { status: 'disconnected' };
    }

    try {
      const pending = await this.redisClient.xpending(this.STREAM_NAME, this.CONSUMER_GROUP);

      return {
        status: 'running',
        consumerGroup: this.CONSUMER_GROUP,
        consumerName: this.CONSUMER_NAME,
        pendingMessages: pending[0],
        processedKeysCount: this.processedKeys.size,
      };
    } catch (error) {
      this.logger.error(`Failed to get worker stats: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }
}
