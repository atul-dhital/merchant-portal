import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, defer, of, throwError } from 'rxjs';
import { applicationData, summary } from '../../../../testing/fixtures';
import { ApplicationData, SaveResult } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_RETRY_BASE_MS,
  DraftAutosaveService,
} from './draft-autosave.service';

const saved = (id = 'app-1'): SaveResult => ({
  id,
  reference: 'MA-1',
  updatedAt: '2026-01-01T10:00:00Z',
});
const httpError = (status: number) =>
  new HttpErrorResponse({ status, error: { message: `HTTP ${status}` } });

describe('DraftAutosaveService', () => {
  let api: {
    createDraft: ReturnType<typeof vi.fn>;
    saveDraft: ReturnType<typeof vi.fn>;
    submit: ReturnType<typeof vi.fn>;
  };
  let service: DraftAutosaveService;
  let changes$: Subject<void>;
  let value: ApplicationData;

  /** Simulates the user editing the form. */
  const type = (legalName: string) => {
    value = { ...value, business: { ...value.business, legalName } };
    changes$.next();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      createDraft: vi.fn(() => of(saved())),
      saveDraft: vi.fn(() => of(saved())),
      submit: vi.fn(() => of(summary({ id: 'app-1', status: 'SUBMITTED' }))),
    };
    TestBed.configureTestingModule({
      providers: [DraftAutosaveService, { provide: ApplicationsApi, useValue: api }],
    });
    service = TestBed.inject(DraftAutosaveService);
    changes$ = new Subject<void>();
    value = applicationData();
    service.connect(changes$, () => value, TestBed.inject(DestroyRef));
  });

  afterEach(() => vi.useRealTimers());

  it('debounces a burst of edits into one save of the latest value', () => {
    type('A');
    type('AB');
    type('ABC');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(api.createDraft).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(api.createDraft).toHaveBeenCalledTimes(1);
    expect(api.createDraft.mock.calls[0][0].business.legalName).toBe('ABC');
    expect(service.state()).toEqual({ status: 'saved', at: '2026-01-01T10:00:00Z' });
    expect(service.draftId()).toBe('app-1');
  });

  it('creates the draft once, then updates it; never overlapping requests', () => {
    const create$ = new Subject<SaveResult>();
    api.createDraft.mockReturnValue(create$);

    type('first');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    type('second'); // happens while the POST is still in flight
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(api.saveDraft).not.toHaveBeenCalled();

    create$.next(saved('app-42'));
    create$.complete();

    expect(api.createDraft).toHaveBeenCalledTimes(1);
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    expect(api.saveDraft.mock.calls[0][0]).toBe('app-42');
    expect(api.saveDraft.mock.calls[0][1].business.legalName).toBe('second');
  });

  it('skips saving when nothing changed since the last save', () => {
    service.saveNow();
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(service.hasUnsavedChanges()).toBe(false);
  });

  it('keeps the form value and reports the error when saving fails, then recovers on the next change', () => {
    api.createDraft.mockReturnValueOnce(throwError(() => httpError(422)));

    type('will fail');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(service.state()).toEqual({ status: 'error', message: 'HTTP 422' });
    expect(value.business.legalName).toBe('will fail'); // untouched
    expect(service.hasUnsavedChanges()).toBe(true);

    type('will succeed'); // the stream is still alive
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(api.createDraft).toHaveBeenCalledTimes(2);
    expect(service.state().status).toBe('saved');
    expect(service.hasUnsavedChanges()).toBe(false);
  });

  it('retries transient failures (5xx / network) with exponential backoff', () => {
    let attempts = 0;
    api.createDraft.mockReturnValue(
      defer(() => (++attempts < 3 ? throwError(() => httpError(503)) : of(saved()))),
    );

    type('x');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(attempts).toBe(1);
    vi.advanceTimersByTime(AUTOSAVE_RETRY_BASE_MS); // 1s
    expect(attempts).toBe(2);
    vi.advanceTimersByTime(AUTOSAVE_RETRY_BASE_MS * 2); // 2s
    expect(attempts).toBe(3);
    expect(service.state().status).toBe('saved');
  });

  it('does not retry client errors (4xx)', () => {
    api.createDraft.mockReturnValue(throwError(() => httpError(403)));
    type('x');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS + 10_000);
    expect(api.createDraft).toHaveBeenCalledTimes(1);
  });

  it('submit waits for an in-flight save and stops further auto-saves', () => {
    const create$ = new Subject<SaveResult>();
    api.createDraft.mockReturnValue(create$);
    type('x');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

    let done = false;
    service.submit().subscribe(() => (done = true));
    expect(api.submit).not.toHaveBeenCalled(); // waiting for the POST

    create$.next(saved('app-7'));
    create$.complete();
    expect(api.createDraft).toHaveBeenCalledTimes(1); // no duplicate draft
    expect(api.submit).toHaveBeenCalledWith('app-7', value);
    expect(done).toBe(true);

    type('after submit');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(api.saveDraft).not.toHaveBeenCalled();
  });
});
