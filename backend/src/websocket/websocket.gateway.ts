import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { RedisService } from '../common/redis.service';
import { ConnectionManagerService } from './connection-manager.service';
import { Logger } from '@nestjs/common';
import * as zlib from 'zlib';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: {
      chunkSize: 8 * 1024,
      level: zlib.constants.Z_DEFAULT_COMPRESSION,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private redisAdapter: any;

  constructor(
    private redisService: RedisService,
    private connectionManager: ConnectionManagerService,
  ) {}

  async afterInit() {
    try {
      const pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });
      const subClient = pubClient.duplicate();

      await pubClient.connect();
      await subClient.connect();

      this.redisAdapter = createAdapter(pubClient, subClient);
      this.server.adapter(this.redisAdapter);

      this.logger.log('Redis adapter configured for multi-instance broadcasting');
    } catch (error) {
      this.logger.warn('Redis adapter initialization failed, using default adapter', error);
    }

    this.setupHeartbeat();
    this.setupDemoDataStream();
  }

  handleConnection(client: Socket) {
    const { warehouse, zone, userId } = client.handshake.query as {
      warehouse?: string;
      zone?: string;
      userId?: string;
    };

    this.connectionManager.trackConnection(client, { warehouse, zone, userId });

    if (warehouse) {
      client.join(`warehouse:${warehouse}`);
      this.logger.log(`Client ${client.id} joined warehouse:${warehouse}`);

      if (zone) {
        client.join(`zone:${warehouse}:${zone}`);
        this.logger.log(`Client ${client.id} joined zone:${warehouse}:${zone}`);
      }
    }

    client.on('subscribe', (data: { warehouse?: string; zone?: string }) => {
      if (data.warehouse) {
        client.join(`warehouse:${data.warehouse}`);
        if (data.zone) {
          client.join(`zone:${data.warehouse}:${data.zone}`);
        }
      }
    });

    client.on('unsubscribe', (data: { warehouse?: string; zone?: string }) => {
      if (data.warehouse) {
        client.leave(`warehouse:${data.warehouse}`);
        if (data.zone) {
          client.leave(`zone:${data.warehouse}:${data.zone}`);
        }
      }
    });

    client.emit('connected', {
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.connectionManager.untrackConnection(client.id);
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  private setupHeartbeat() {
    setInterval(() => {
      const metrics = this.connectionManager.getMetrics();
      this.server.emit('heartbeat', {
        timestamp: new Date().toISOString(),
        connections: metrics.totalConnections,
      });
    }, 30000);
  }

  private setupDemoDataStream() {
    setInterval(() => {
      const payload = {
        type: 'SHIFT_SNAPSHOT',
        warehouseId: 'demo-warehouse',
        shiftCode: 'A',
        timestamp: new Date().toISOString(),
        metrics: {
          picksPerHour: Math.round(300 + Math.random() * 100),
          totalPicks: Math.round(1000 + Math.random() * 500),
          greenLocations: Math.round(100 + Math.random() * 50),
          yellowLocations: Math.round(20 + Math.random() * 20),
          redLocations: Math.round(5 + Math.random() * 10),
          avgRisk: +(3 + Math.random() * 3).toFixed(2),
          status: 'watch',
          anomalyScore: +(Math.random() * 3).toFixed(2),
        },
      };

      this.server.to('warehouse:demo-warehouse').emit('SHIFT_SNAPSHOT', payload);
    }, 10000);
  }

  broadcastToWarehouse(warehouse: string, event: string, data: any) {
    this.server.to(`warehouse:${warehouse}`).emit(event, data);
  }

  broadcastToZone(warehouse: string, zone: string, event: string, data: any) {
    this.server.to(`zone:${warehouse}:${zone}`).emit(event, data);
  }

  getMetrics() {
    return this.connectionManager.getMetrics();
  }
}
