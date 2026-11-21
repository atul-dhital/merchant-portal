import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SALES } from '../../../testing/fixtures';
import { update } from '../../../testing/fake-realtime';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import {
  ApplicationUpdate,
  RealtimeService,
  SOCKET_IO_LOADER,
  describeUpdate,
} from './realtime.service';

type Handler = (...args: unknown[]) => void;

/** Minimal stand-in for a socket.io-client Socket. */
class FakeSocket {
  private readonly handlers = new Map<string, Handler[]>();
  auth!: (cb: (data: { token: string | null }) => void) => void;
  connectCalls = 0;
  disconnected = false;

  on(event: string, fn: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((fn) => fn(...args));
  }
  connect() {
    this.connectCalls++;
  }
  disconnect() {
    this.disconnected = true;
  }
  removeAllListeners() {
    this.handlers.clear();
  }
  /** The token the socket would send on its next handshake. */
  token(): string | null {
    let token: string | null = null;
    this.auth((data) => (token = data.token));
    return token;
  }
}

describe('RealtimeService', () => {
  let sockets: FakeSocket[];
  let io: ReturnType<typeof vi.fn>;
  let store: AuthStore;
  let refresh: ReturnType<typeof vi.fn>;
  let service: RealtimeService;

  const settle = async () => {
    TestBed.tick(); // run the sign-in effect
    await vi.waitFor(() => expect(io).toHaveBeenCalled());
  };

  beforeEach(() => {
    sockets = [];
    io = vi.fn((opts: { auth: FakeSocket['auth'] }) => {
      const socket = new FakeSocket();
      socket.auth = opts.auth;
      sockets.push(socket);
      return socket;
    });
    refresh = vi.fn(() => {
      store.setSession({ accessToken: 'fresh-token', user: SALES });
      return of('fresh-token');
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SOCKET_IO_LOADER, useValue: () => Promise.resolve(io) },
        { provide: AuthService, useValue: { refreshAccessToken: refresh } },
      ],
    });
    store = TestBed.inject(AuthStore);
    service = TestBed.inject(RealtimeService);
  });

  it('stays offline while signed out', () => {
    TestBed.tick();
    expect(io).not.toHaveBeenCalled();
    expect(service.status()).toBe('offline');
  });

  it('connects once signed in, sending the current access token, and goes live', async () => {
    store.setSession({ accessToken: 'token-1', user: SALES });
    await settle();
    expect(io).toHaveBeenCalledTimes(1);
    expect(sockets[0].token()).toBe('token-1');
    expect(service.status()).toBe('connecting');

    sockets[0].fire('connect');
    expect(service.status()).toBe('live');
  });

  it('forwards application updates to subscribers', async () => {
    store.setSession({ accessToken: 'token-1', user: SALES });
    await settle();
    const received: ApplicationUpdate[] = [];
    service.applicationUpdates$.subscribe((u) => received.push(u));

    sockets[0].fire('application:updated', update());
    expect(received).toEqual([update()]);
  });

  it('renews an expired token through the shared refresh, then reconnects with it', async () => {
    store.setSession({ accessToken: 'expired', user: SALES });
    await settle();

    sockets[0].fire('connect_error', new Error('unauthorized'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sockets[0].connectCalls).toBe(1);
    expect(sockets[0].token()).toBe('fresh-token');
  });

  it('reconnects after the server drops an expired socket, but not after a network blip', async () => {
    store.setSession({ accessToken: 'token-1', user: SALES });
    await settle();

    sockets[0].fire('disconnect', 'transport close'); // socket.io retries this by itself
    expect(refresh).not.toHaveBeenCalled();

    sockets[0].fire('disconnect', 'io server disconnect');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sockets[0].connectCalls).toBe(1);
  });

  it('disconnects on sign-out', async () => {
    store.setSession({ accessToken: 'token-1', user: SALES });
    await settle();
    store.clear();
    TestBed.tick();
    expect(sockets[0].disconnected).toBe(true);
    expect(service.status()).toBe('offline');
  });
});

describe('describeUpdate', () => {
  const app = update().application;

  it.each<[Partial<ApplicationUpdate>, string]>([
    [
      { type: 'SUBMITTED', actorName: 'Sam Sales' },
      'MA-2026-0001 submitted for review by Sam Sales',
    ],
    [
      { type: 'ASSIGNED', actorName: 'Ada Admin' },
      'MA-2026-0001 assigned to Riya Reviewer by Ada Admin',
    ],
    [{ type: 'DECISION' }, 'MA-2026-0001 approved by Riya Reviewer'],
    [
      { type: 'DECISION', application: { ...app, status: 'INFO_REQUESTED' } },
      'MA-2026-0001 returned for more information by Riya Reviewer',
    ],
  ])('%o → "%s"', (overrides, expected) => {
    expect(describeUpdate(update(overrides))).toBe(expected);
  });
});
