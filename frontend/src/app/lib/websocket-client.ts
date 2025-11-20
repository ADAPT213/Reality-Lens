import { io, Socket } from 'socket.io-client';

interface WebSocketConfig {
  url: string;
  warehouse?: string;
  zone?: string;
  userId?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  attemptCount: number;
  lastError?: Error;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: Required<WebSocketConfig>;
  private state: ConnectionState = {
    connected: false,
    reconnecting: false,
    attemptCount: 0,
  };
  private listeners = new Map<string, Set<(data: any) => void>>();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      warehouse: config.warehouse || '',
      zone: config.zone || '',
      userId: config.userId || '',
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.config.url, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 10000,
        query: {
          warehouse: this.config.warehouse,
          zone: this.config.zone,
          userId: this.config.userId,
        },
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.handleReconnect();
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.state.connected = true;
        this.state.reconnecting = false;
        this.state.attemptCount = 0;
        console.log('[WebSocket] Connected:', this.socket?.id);
        this.reattachListeners();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[WebSocket] Disconnected:', reason);
        this.state.connected = false;
        if (this.config.autoReconnect && reason !== 'io client disconnect') {
          this.handleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('[WebSocket] Connection error:', error);
        this.state.lastError = error;
        clearTimeout(timeout);
        reject(error);
        this.handleReconnect();
      });

      this.socket.on('heartbeat', (data) => {
        console.debug('[WebSocket] Heartbeat:', data);
      });

      this.socket.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
        this.state.lastError = error;
      });
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.state.connected = false;
    this.state.reconnecting = false;
    this.state.attemptCount = 0;
  }

  on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    } else {
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }

  emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] Cannot emit, not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  subscribe(warehouse: string, zone?: string): void {
    this.emit('subscribe', { warehouse, zone });
  }

  unsubscribe(warehouse: string, zone?: string): void {
    this.emit('unsubscribe', { warehouse, zone });
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected && this.socket?.connected === true;
  }

  private handleReconnect(): void {
    if (!this.config.autoReconnect || this.state.reconnecting) {
      return;
    }

    if (this.state.attemptCount >= this.config.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.state.reconnecting = true;
    this.state.attemptCount++;

    const delay = Math.min(1000 * Math.pow(2, this.state.attemptCount - 1), 30000);
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.state.attemptCount})`);

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Attempting reconnection...');
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  private reattachListeners(): void {
    if (!this.socket) return;

    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }
}

export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
  return new WebSocketClient(config);
}
