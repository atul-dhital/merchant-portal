import { Provider, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  ApplicationUpdate,
  RealtimeService,
  RealtimeStatus,
} from '../app/core/realtime/realtime.service';

/** A RealtimeService stand-in: no socket; tests push updates through `updates`. */
export function fakeRealtime(): { updates: Subject<ApplicationUpdate>; provider: Provider } {
  const updates = new Subject<ApplicationUpdate>();
  return {
    updates,
    provider: {
      provide: RealtimeService,
      useValue: {
        applicationUpdates$: updates.asObservable(),
        status: signal<RealtimeStatus>('live'),
      },
    },
  };
}

export function update(overrides: Partial<ApplicationUpdate> = {}): ApplicationUpdate {
  return {
    type: 'DECISION',
    application: {
      id: 'app-001',
      reference: 'MA-2026-0001',
      status: 'APPROVED',
      assignedReviewerName: 'Riya Reviewer',
    },
    actorId: 'u-rev-1',
    actorName: 'Riya Reviewer',
    at: '2026-11-21T10:00:00.000Z',
    ...overrides,
  };
}
