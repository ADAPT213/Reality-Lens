import { io, Socket } from 'socket.io-client';

interface LoadTestConfig {
  url: string;
  concurrentConnections: number;
  messagesPerSecond: number;
  duration: number;
  warehouse?: string;
  zone?: string;
}

interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

class WebSocketLoadTest {
  private sockets: Socket[] = [];
  private latencies: number[] = [];
  private messagesReceived = 0;
  private messagesSent = 0;
  private errors = 0;
  private reconnections = 0;
  private startTime = 0;

  async run(config: LoadTestConfig): Promise<void> {
    console.log(`\n🚀 Starting WebSocket load test`);
    console.log(`   Target: ${config.url}`);
    console.log(`   Connections: ${config.concurrentConnections}`);
    console.log(`   Messages/sec: ${config.messagesPerSecond}`);
    console.log(`   Duration: ${config.duration}s\n`);

    this.startTime = Date.now();

    await this.createConnections(config);
    await this.runMessageLoad(config);
    await this.cleanup();

    this.printResults(config);
  }

  private async createConnections(config: LoadTestConfig): Promise<void> {
    const batchSize = 50;
    const batches = Math.ceil(config.concurrentConnections / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<void>[] = [];
      const connectionsInBatch = Math.min(
        batchSize,
        config.concurrentConnections - batch * batchSize,
      );

      for (let i = 0; i < connectionsInBatch; i++) {
        batchPromises.push(this.createConnection(config, batch * batchSize + i));
      }

      await Promise.all(batchPromises);
      process.stdout.write(
        `\rConnecting: ${Math.min((batch + 1) * batchSize, config.concurrentConnections)}/${config.concurrentConnections}`,
      );
    }

    console.log(`\n✓ ${this.sockets.length} connections established\n`);
  }

  private createConnection(config: LoadTestConfig, index: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = io(config.url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        query: {
          warehouse: config.warehouse || `warehouse-${index % 10}`,
          zone: config.zone || `zone-${index % 5}`,
          userId: `load-test-${index}`,
        },
      });

      const timeout = setTimeout(() => {
        this.errors++;
        reject(new Error(`Connection timeout for socket ${index}`));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        this.sockets.push(socket);
        resolve();
      });

      socket.on('reconnect', () => {
        this.reconnections++;
      });

      socket.on('error', (error) => {
        this.errors++;
        console.error(`Socket ${index} error:`, error);
      });

      socket.on('SHIFT_SNAPSHOT', (data) => {
        const latency = Date.now() - new Date(data.timestamp).getTime();
        this.latencies.push(latency);
        this.messagesReceived++;
      });

      socket.on('heartbeat', () => {
        this.messagesReceived++;
      });
    });
  }

  private async runMessageLoad(config: LoadTestConfig): Promise<void> {
    const interval = 1000 / config.messagesPerSecond;
    const endTime = Date.now() + config.duration * 1000;

    console.log(`📊 Running load test for ${config.duration}s...\n`);

    const intervalId = setInterval(() => {
      const randomSocket = this.sockets[Math.floor(Math.random() * this.sockets.length)];
      if (randomSocket?.connected) {
        randomSocket.emit('ping', { timestamp: Date.now() });
        this.messagesSent++;
      }

      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      process.stdout.write(
        `\rElapsed: ${elapsed}s | Sent: ${this.messagesSent} | Received: ${this.messagesReceived} | Errors: ${this.errors}`,
      );
    }, interval);

    await new Promise((resolve) => setTimeout(resolve, config.duration * 1000));
    clearInterval(intervalId);
    console.log('\n');
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up connections...');
    for (const socket of this.sockets) {
      socket.disconnect();
    }
    this.sockets = [];
  }

  private printResults(config: LoadTestConfig): void {
    const duration = (Date.now() - this.startTime) / 1000;
    const connectedSockets = this.sockets.filter((s) => s.connected).length;

    console.log('\n📈 Load Test Results');
    console.log('='.repeat(50));
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Concurrent Connections: ${config.concurrentConnections}`);
    console.log(`Connected at End: ${connectedSockets}`);
    console.log(`Messages Sent: ${this.messagesSent}`);
    console.log(`Messages Received: ${this.messagesReceived}`);
    console.log(`Errors: ${this.errors}`);
    console.log(`Reconnections: ${this.reconnections}`);
    console.log(`Throughput: ${(this.messagesReceived / duration).toFixed(2)} msg/s`);

    if (this.latencies.length > 0) {
      const metrics = this.calculateLatencyMetrics();
      console.log('\n📊 Latency Metrics (ms)');
      console.log('='.repeat(50));
      console.log(`Min: ${metrics.min.toFixed(2)}`);
      console.log(`Max: ${metrics.max.toFixed(2)}`);
      console.log(`Avg: ${metrics.avg.toFixed(2)}`);
      console.log(`P50: ${metrics.p50.toFixed(2)}`);
      console.log(`P95: ${metrics.p95.toFixed(2)}`);
      console.log(`P99: ${metrics.p99.toFixed(2)}`);
    }

    const successRate = ((this.messagesReceived / (this.messagesSent || 1)) * 100).toFixed(2);
    console.log(`\n✓ Success Rate: ${successRate}%\n`);
  }

  private calculateLatencyMetrics(): LatencyMetrics {
    const sorted = this.latencies.sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / len,
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }
}

async function main() {
  const config: LoadTestConfig = {
    url: process.env.WS_URL || 'http://localhost:3001',
    concurrentConnections: parseInt(process.env.CONNECTIONS || '1000', 10),
    messagesPerSecond: parseInt(process.env.MSG_PER_SEC || '100', 10),
    duration: parseInt(process.env.DURATION || '60', 10),
    warehouse: process.env.WAREHOUSE,
    zone: process.env.ZONE,
  };

  const test = new WebSocketLoadTest();
  await test.run(config);
  process.exit(0);
}

main().catch((error) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
