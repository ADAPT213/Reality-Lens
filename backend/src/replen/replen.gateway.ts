import { WebSocketGateway, SubscribeMessage, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/replen',
})
export class ReplenGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ReplenGateway.name);

  @SubscribeMessage('join-replen-room')
  handleJoinReplenRoom(client: Socket, warehouseId: string) {
    const room = `replen:warehouse:${warehouseId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined replen room: ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leave-replen-room')
  handleLeaveReplenRoom(client: Socket, warehouseId: string) {
    const room = `replen:warehouse:${warehouseId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left replen room: ${room}`);
    return { success: true, room };
  }

  emitMoveCompleted(warehouseId: string, moveData: any) {
    this.server.to(`replen:warehouse:${warehouseId}`).emit('replen:move-completed', moveData);
    this.logger.log(`Emitted move-completed event for warehouse ${warehouseId}`);
  }

  emitCountdown(warehouseId: string, countdownData: any) {
    this.server.to(`replen:warehouse:${warehouseId}`).emit('replen:countdown', countdownData);
    this.logger.log(`Emitted countdown event for warehouse ${warehouseId}`);
  }
}
