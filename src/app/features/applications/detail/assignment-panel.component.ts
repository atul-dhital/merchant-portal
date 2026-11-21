import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of, startWith } from 'rxjs';
import { User } from '../../../core/auth/auth.models';
import { errorMessage } from '../../../core/http/error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { ApplicationsApi } from '../data-access/applications.api';

type ReviewersState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; users: User[] };

@Component({
  selector: 'app-assignment-panel',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let state = reviewers();
    @if (state.status === 'loading') {
      <p class="text-body-secondary mb-0" role="status">Loading reviewers…</p>
    } @else if (state.status === 'error') {
      <div class="alert alert-danger mb-0" role="alert">Could not load reviewers.</div>
    } @else if (!hasChoice(state.users)) {
      <!-- e.g. the only reviewer is already assigned: nothing to choose from -->
      <p class="text-body-secondary mb-0">
        @if (currentReviewerId()) {
          Assigned to {{ nameOf(state.users, currentReviewerId()) }}. No other reviewer is
          available.
        } @else {
          No reviewers are available yet.
        }
      </p>
    } @else {
      <form
        class="d-flex flex-wrap gap-2 align-items-end"
        (submit)="$event.preventDefault(); assign()"
      >
        <div class="flex-grow-1">
          <label for="reviewer" class="form-label">Reviewer</label>
          <select id="reviewer" class="form-select" [formControl]="reviewer">
            <option value="" disabled>Select a reviewer…</option>
            @for (u of state.users; track u.id) {
              <option [value]="u.id" [disabled]="u.id === currentReviewerId()">
                {{ u.name }}{{ u.id === currentReviewerId() ? ' (current)' : '' }}
              </option>
            }
          </select>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="reviewer.invalid || saving()">
          {{ currentReviewerId() ? 'Reassign' : 'Assign' }}
        </button>
      </form>
    }
    @if (error(); as message) {
      <div class="alert alert-danger mt-2 mb-0" role="alert">{{ message }}</div>
    }
  `,
})
export class AssignmentPanelComponent {
  private readonly api = inject(ApplicationsApi);
  private readonly toasts = inject(ToastService);

  readonly applicationId = input.required<string>();
  readonly currentReviewerId = input<string | null>(null);
  readonly assigned = output<void>();

  protected readonly reviewer = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly reviewers = toSignal(
    this.api.reviewers().pipe(
      map((users): ReviewersState => ({ status: 'ready', users })),
      catchError(() => of<ReviewersState>({ status: 'error' })),
      startWith<ReviewersState>({ status: 'loading' }),
    ),
    { requireSync: true },
  );

  /** True when at least one reviewer other than the current one can be picked. */
  hasChoice(users: User[]): boolean {
    return users.some((u) => u.id !== this.currentReviewerId());
  }

  nameOf(users: User[], id: string | null): string {
    return users.find((u) => u.id === id)?.name ?? 'the current reviewer';
  }

  assign(): void {
    if (this.reviewer.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const reviewerId = this.reviewer.value;
    this.api.assign(this.applicationId(), reviewerId).subscribe({
      next: () => {
        const state = this.reviewers();
        const name =
          state.status === 'ready' ? state.users.find((u) => u.id === reviewerId)?.name : '';
        this.saving.set(false);
        this.reviewer.reset();
        this.toasts.show(name ? `Assigned to ${name}.` : 'Reviewer assigned.');
        this.assigned.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(err, 'Could not assign the reviewer.'));
      },
    });
  }
}
