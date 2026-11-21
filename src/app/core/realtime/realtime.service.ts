import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import type { Socket, io as ioFactory } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';

/** What the server pushes when an application the user can see changes. */
export interface ApplicationUpdate {
  type: 'CREATED' | 'SUBMITTED' | 'ASSIGNED' | 'DECISION';
  application: {
    id: string;
    reference: string;
    status: string;
    assignedReviewerName: string | null;
  };
  actorId: string;
  actorName: string;
  at: string;
}

export type RealtimeStatus = 'offline' | 'connecting' | 'live';

/**
 * Loads the Socket.IO client on demand, so it is a lazy chunk and not part of the
 * initial bundle. Tests replace it with a fake.
 */
export const SOCKET_IO_LOADER = new InjectionToken<() => Promise<typeof ioFactory>>(
  'SOCKET_IO_LOADER',
  {
    providedIn: 'root',
    factory: () => () => import('socket.io-client').then((m) => m.io),
  },
);

/**
 * Real-time status updates (Socket.IO). Connected while a user is signed in.
 *
 * The access token is sent in the handshake and read fresh on every (re)connect.
 * When the server rejects or drops the socket because the token expired, the token is
 * renewed through AuthService.refreshAccessToken(), the same single shared refresh
 * the HTTP interceptor uses, and the socket reconnects.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly store = inject(AuthStore);
  private readonly auth = inject(AuthService);
  private readonly loadIo = inject(SOCKET_IO_LOADER);

  private socket: Socket | null = null;
  private connecting = false;
  private readonly updates = new Subject<ApplicationUpdate>();

  readonly applicationUpdates$ = this.updates.asObservable();
  readonly status = signal<RealtimeStatus>('offline');

  constructor() {
    // Keyed on the user (not the token), so routine token refreshes don't reconnect.
    effect(() => {
      const signedIn = this.store.user() !== null;
      untracked(() => (signedIn ? void this.connect() : this.disconnect()));
    });
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.status.set('offline');
  }

  private async connect(): Promise<void> {
    if (this.socket || this.connecting) return;
    this.connecting = true;
    this.status.set('connecting');
    try {
      const io = await this.loadIo();
      if (!this.store.user()) return; // signed out while the client was loading
      const socket = io({
        path: '/socket.io',
        transports: ['websocket'],
        auth: (cb) => cb({ token: this.store.accessToken() }),
      });
      socket.on('connect', () => this.status.set('live'));
      socket.on('application:updated', (update: ApplicationUpdate) => this.updates.next(update));
      socket.on('connect_error', (err: Error) => {
        this.status.set('connecting');
        if (err.message === 'unauthorized') this.renewAndReconnect(socket);
      });
      socket.on('disconnect', (reason: string) => {
        this.status.set('connecting');
        // Server-side disconnects (expired token) are not retried automatically.
        if (reason === 'io server disconnect') this.renewAndReconnect(socket);
      });
      this.socket = socket;
    } catch {
      this.status.set('offline');
    } finally {
      this.connecting = false;
    }
  }

  private renewAndReconnect(socket: Socket): void {
    this.auth.refreshAccessToken().subscribe({
      next: () => {
        if (this.socket === socket) socket.connect();
      },
      // A failed refresh ends the session; the effect above then disconnects.
      error: () => undefined,
    });
  }
}

const DECISION_WORDS: Record<string, string> = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  INFO_REQUESTED: 'returned for more information',
};

/** Short sentence for a toast, e.g. "MA-2026-0031 approved by Riya Reviewer". */
export function describeUpdate(update: ApplicationUpdate): string {
  const { reference, status, assignedReviewerName } = update.application;
  const by = `by ${update.actorName}`;
  switch (update.type) {
    case 'CREATED':
      return `${reference} created ${by}`;
    case 'SUBMITTED':
      return `${reference} submitted for review ${by}`;
    case 'ASSIGNED':
      return `${reference} assigned to ${assignedReviewerName ?? 'a reviewer'} ${by}`;
    case 'DECISION':
      return `${reference} ${DECISION_WORDS[status] ?? 'updated'} ${by}`;
  }
}
