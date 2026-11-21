import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  defer,
  filter,
  finalize,
  map,
  merge,
  of,
  retry,
  switchMap,
  take,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { errorMessage } from '../../../core/http/error-message';
import { ApplicationData, ApplicationSummary } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';

export const AUTOSAVE_DEBOUNCE_MS = 1500;
export const AUTOSAVE_MAX_RETRIES = 2;
export const AUTOSAVE_RETRY_BASE_MS = 1000;

export type AutosaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: string }
  | { status: 'error'; message: string };

/** Only network failures and 5xx are worth retrying; 4xx won't fix themselves. */
const isTransient = (error: unknown) =>
  error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);

/**
 * Debounced draft auto-save, scoped to one wizard instance.
 *
 * - `debounceTime` collapses bursts of typing into one save.
 * - `concatMap` runs saves strictly one after another, so the first POST (which
 *   creates the draft and returns its id) can never race a later PUT.
 * - The value is read when the save actually starts, so a queued save always
 *   sends the latest form state; unchanged values are skipped.
 * - Errors are caught inside the inner observable, so the stream survives and the
 *   next change saves again. The form is never written to: no input is ever lost.
 */
@Injectable()
export class DraftAutosaveService {
  private readonly api = inject(ApplicationsApi);

  readonly draftId = signal<string | null>(null);
  readonly reference = signal<string | null>(null);
  readonly state = signal<AutosaveState>({ status: 'idle' });

  private readonly flush$ = new Subject<void>();
  private readonly saving$ = new BehaviorSubject(false);
  private read: () => ApplicationData = () => {
    throw new Error('DraftAutosaveService.connect() was not called');
  };
  private lastSavedJson = '';
  private paused = false;

  /** Starts watching `changes$`. The current value is the baseline (nothing to save yet). */
  connect(
    changes$: Observable<unknown>,
    read: () => ApplicationData,
    destroyRef: DestroyRef,
  ): void {
    this.read = read;
    this.lastSavedJson = JSON.stringify(read());

    merge(changes$.pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS)), this.flush$)
      .pipe(
        concatMap(() => defer(() => this.saveLatest())),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  }

  /** For an existing draft opened for editing. */
  useExistingDraft(id: string, reference: string): void {
    this.draftId.set(id);
    this.reference.set(reference);
  }

  /** Save immediately (step change, "Save draft" button, retry). */
  saveNow(): void {
    this.flush$.next();
  }

  hasUnsavedChanges(): boolean {
    return this.saving$.value || JSON.stringify(this.read()) !== this.lastSavedJson;
  }

  /**
   * Submits the latest value. Waits for any in-flight save first (so a draft is never
   * created twice) and pauses auto-save so no PUT follows the submission.
   */
  submit(): Observable<ApplicationSummary> {
    this.paused = true;
    return this.saving$.pipe(
      filter((saving) => !saving),
      take(1),
      switchMap(() => {
        const value = this.read();
        const id = this.draftId();
        const id$ = id
          ? of(id)
          : this.api.createDraft(value).pipe(
              tap((res) => this.useExistingDraft(res.id, res.reference)),
              map((res) => res.id),
            );
        return id$.pipe(
          switchMap((draftId) => this.api.submit(draftId, value)),
          tap(() => (this.lastSavedJson = JSON.stringify(value))),
        );
      }),
      catchError((err: unknown) => {
        this.paused = false;
        return throwError(() => err);
      }),
    );
  }

  private saveLatest(): Observable<unknown> {
    if (this.paused) return EMPTY;
    const value = this.read();
    const json = JSON.stringify(value);
    if (json === this.lastSavedJson) return EMPTY;

    const id = this.draftId();
    const request$ = id ? this.api.saveDraft(id, value) : this.api.createDraft(value);

    this.state.set({ status: 'saving' });
    this.saving$.next(true);
    return request$.pipe(
      retry({
        count: AUTOSAVE_MAX_RETRIES,
        delay: (error: unknown, attempt) =>
          isTransient(error)
            ? timer(AUTOSAVE_RETRY_BASE_MS * 2 ** (attempt - 1))
            : throwError(() => error),
      }),
      tap((res) => {
        this.useExistingDraft(res.id, res.reference);
        this.lastSavedJson = json;
        this.state.set({ status: 'saved', at: res.updatedAt });
      }),
      catchError((err: unknown) => {
        this.state.set({
          status: 'error',
          message: errorMessage(err, 'Draft could not be saved.'),
        });
        return EMPTY;
      }),
      finalize(() => this.saving$.next(false)),
    );
  }
}
