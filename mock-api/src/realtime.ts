/**
 * Real-time status updates over Socket.IO.
 *
 * - Authenticated with the access token sent in the handshake (`auth.token`), never a
 *   cookie, so a hostile site can't open a socket on the user's behalf (no CSWSH).
 * - Every update is delivered only to sockets whose user may see that application
 *   (the same `policy.canView` rule the REST API uses), so nothing leaks across roles.
 * - Payloads carry the list summary only: no sensitive fields.
 * - Sockets whose access token has expired are disconnected; the client refreshes its
 *   token and reconnects.
 */
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { userForAccessToken } from './auth';
import { policy } from './policy';
import type { Application, User } from './types';

export type UpdateType = 'CREATED' | 'SUBMITTED' | 'ASSIGNED' | 'DECISION';

const TOKEN_CHECK_MS = 5_000;
let io: Server | null = null;

export function attachRealtime(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    transports: ['websocket'],
  });

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.['token'];
    const user = userForAccessToken(token);
    if (!user) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data['user'] = user;
    socket.data['token'] = token;
    next();
  });

  setInterval(() => {
    for (const socket of io!.sockets.sockets.values()) {
      if (!userForAccessToken(socket.data['token'])) socket.disconnect(true);
    }
  }, TOKEN_CHECK_MS).unref();
}

/** Tells every connected user who can see `app` that it changed. */
export function publishUpdate(
  app: Application,
  summary: object,
  type: UpdateType,
  actor: User,
): void {
  if (!io) return;
  const payload = {
    type,
    application: summary,
    actorId: actor.id,
    actorName: actor.name,
    at: new Date().toISOString(),
  };
  for (const socket of io.sockets.sockets.values()) {
    if (policy.canView(socket.data['user'] as User, app))
      socket.emit('application:updated', payload);
  }
}
