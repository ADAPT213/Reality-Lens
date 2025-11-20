import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

interface ConnectionMetrics {
  connectedAt: Date;
  messageCount: number;
  lastMessageAt: Date;
  warehouse?: string;
  zone?: string;
  userId?: string;
  rateLimitTokens: number;
  lastTokenRefill: Date;
}

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private connections = new Map<string, ConnectionMetrics>();
  private readonly RATE_LIMIT_TOKENS = 100;
  private readonly RATE_LIMIT_REFILL = 10;
  private readonly RATE_LIMIT_INTERVAL = 1000;
  private readonly SLOW_CLIENT_THRESHOLD = 1000;

  constructor() {
    setInterval(() => this.refillRateLimitTokens(), this.RATE_LIMIT_INTERVAL);
    setInterval(() => this.logMetrics(), 60000);
  }

  trackConnection(
    socket: Socket,
    metadata?: { warehouse?: string; zone?: string; userId?: string },
  ) {
    const metrics: ConnectionMetrics = {
      connectedAt: new Date(),
      messageCount: 0,
      lastMessageAt: new Date(),
      rateLimitTokens: this.RATE_LIMIT_TOKENS,
      lastTokenRefill: new Date(),
      ...metadata,
    };

    this.connections.set(socket.id, metrics);
    this.logger.log(`Connection tracked: ${socket.id} (Total: ${this.connections.size})`);
  }

  untrackConnection(socketId: string) {
    const metrics = this.connections.get(socketId);
    if (metrics) {
      const duration = Date.now() - metrics.connectedAt.getTime();
      this.logger.log(
        `Connection untracked: ${socketId} (Duration: ${Math.round(duration / 1000)}s, Messages: ${metrics.messageCount})`,
      );
      this.connections.delete(socketId);
    }
  }

  checkRateLimit(socketId: string): boolean {
    const metrics = this.connections.get(socketId);
    if (!metrics) return false;

    if (metrics.rateLimitTokens > 0) {
      metrics.rateLimitTokens--;
      metrics.messageCount++;
      metrics.lastMessageAt = new Date();
      return true;
    }

    this.logger.warn(`Rate limit exceeded for connection: ${socketId}`);
    return false;
  }

  isSlowClient(socketId: string): boolean {
    const metrics = this.connections.get(socketId);
    if (!metrics) return false;

    const timeSinceLastMessage = Date.now() - metrics.lastMessageAt.getTime();
    return timeSinceLastMessage > this.SLOW_CLIENT_THRESHOLD;
  }

  getConnectionsByWarehouse(warehouse: string): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, metrics]) => metrics.warehouse === warehouse)
      .map(([socketId]) => socketId);
  }

  getConnectionsByZone(warehouse: string, zone: string): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, metrics]) => metrics.warehouse === warehouse && metrics.zone === zone)
      .map(([socketId]) => socketId);
  }

  getMetrics() {
    const now = Date.now();
    const connections = Array.from(this.connections.values());

    return {
      totalConnections: connections.length,
      avgMessagesPerConnection:
        connections.length > 0
          ? Math.round(connections.reduce((sum, m) => sum + m.messageCount, 0) / connections.length)
          : 0,
      connectionsByWarehouse: this.groupBy(connections, 'warehouse'),
      connectionsByZone: this.groupBy(connections, 'zone'),
      avgConnectionDuration:
        connections.length > 0
          ? Math.round(
              connections.reduce((sum, m) => sum + (now - m.connectedAt.getTime()), 0) /
                connections.length /
                1000,
            )
          : 0,
    };
  }

  private refillRateLimitTokens() {
    for (const metrics of this.connections.values()) {
      metrics.rateLimitTokens = Math.min(
        this.RATE_LIMIT_TOKENS,
        metrics.rateLimitTokens + this.RATE_LIMIT_REFILL,
      );
      metrics.lastTokenRefill = new Date();
    }
  }

  private logMetrics() {
    const metrics = this.getMetrics();
    this.logger.log(
      `WebSocket Metrics - Connections: ${metrics.totalConnections}, Avg Messages: ${metrics.avgMessagesPerConnection}, Avg Duration: ${metrics.avgConnectionDuration}s`,
    );
  }

  private groupBy(
    connections: ConnectionMetrics[],
    key: 'warehouse' | 'zone',
  ): Record<string, number> {
    return connections.reduce(
      (acc, conn) => {
        const value = conn[key];
        if (value) {
          acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
