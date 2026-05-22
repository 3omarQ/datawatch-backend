import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Log } from 'src/generated/prisma/client';
import { ACCESS_TOKEN_COOKIE, getCookieValue } from 'src/auth/auth-cookie';

const USER_ROOM_PREFIX = 'user:';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  constructor(private readonly jwtService: JwtService) { }

  async handleConnection(client: Socket) {
    const userId = this.extractUserId(client);
    if (!userId) {
      client.disconnect();
      return;
    }
    await client.join(this.userRoom(userId));
    this.logger.log(`Client connected: ${client.id} → user ${userId}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  pushToUser(userId: string, notification: object) {
    this.server.to(this.userRoom(userId)).emit('notification', notification);
  }

  pushLogToUser(userId: string, payload: { executionId: string; log: Log }) {
    this.server
      .to(this.userRoom(userId)) // was .to(userId) — missing the prefix
      .emit('execution:log', payload);
  }

  private extractUserId(client: Socket): string | null {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        getCookieValue(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE);
      if (!token) return null;
      const payload = this.jwtService.verify(token);
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  private userRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
  }
}
