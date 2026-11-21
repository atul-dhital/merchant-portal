import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { errorMessage } from '../../../core/http/error-message';
import { SensitiveField } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';

export const REVEAL_DURATION_MS = 30_000;

/**
 * Sensitive value: masked by default. Users with permission can reveal it; the
 * API checks permission again and writes an audit event. The clear value is kept
 * only in this component's memory and is hidden again after 30 seconds.
 */
@Component({
  selector: 'app-masked-value',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-inline-flex flex-wrap align-items-center gap-2' },
  styles: `
    .revealed {
      position: relative;
      padding: 0 0.25rem 0.2rem;
      border-radius: 0.25rem;
      background: rgba(255, 159, 0, 0.15);
    }
    /* Visual countdown until the value is masked again (pure CSS, no timers). */
    .reveal-timer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: #ff9f00;
      transform-origin: left;
      animation: shrink-x var(--reveal-ms) linear forwards;
    }
  `,
  template: `
    <span class="font-monospace-digits" [class.revealed]="value()" [class.fade-in]="value()">
      <!-- Plain spans can't carry aria-label; give screen readers context as hidden text. -->
      <span class="visually-hidden">{{ label() }}: </span>
      {{ value() ?? masked() }}
      <span class="visually-hidden">{{ value() ? '(revealed)' : '(masked)' }}</span>
      @if (value()) {
        <span class="reveal-timer" aria-hidden="true" [style.--reveal-ms]="revealMs + 'ms'"></span>
      }
    </span>
    @if (canReveal()) {
      @if (value()) {
        <button type="button" class="btn btn-link btn-sm p-0" (click)="hide()">
          Hide<span class="visually-hidden"> {{ label() }}</span>
        </button>
      } @else {
        <button
          type="button"
          class="btn btn-link btn-sm p-0"
          [disabled]="loading()"
          (click)="reveal()"
        >
          Reveal<span class="visually-hidden"> {{ label() }}</span>
        </button>
      }
    }
    <span class="visually-hidden" aria-live="polite">
      {{ value() ? label() + ' revealed. It will be hidden again in 30 seconds.' : '' }}
    </span>
    @if (error(); as message) {
      <span class="small text-danger-emphasis" role="alert">{{ message }}</span>
    }
  `,
})
export class MaskedValueComponent {
  private readonly api = inject(ApplicationsApi);

  readonly applicationId = input.required<string>();
  readonly field = input.required<SensitiveField>();
  readonly masked = input.required<string>();
  readonly label = input.required<string>();
  readonly canReveal = input(false);
  /** Lets the parent refresh the audit trail. */
  readonly revealed = output<void>();

  protected readonly value = signal<string | null>(null);
  protected readonly revealMs = REVEAL_DURATION_MS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
    // A revealed value belongs to one application/field: re-mask if either changes.
    effect(() => {
      this.applicationId();
      this.field();
      untracked(() => this.hide());
    });
  }

  reveal(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.reveal(this.applicationId(), this.field()).subscribe({
      next: (value) => {
        this.loading.set(false);
        this.value.set(value);
        this.hideTimer = setTimeout(() => this.hide(), REVEAL_DURATION_MS);
        this.revealed.emit();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(errorMessage(err, 'Could not reveal this value.'));
      },
    });
  }

  hide(): void {
    clearTimeout(this.hideTimer);
    this.value.set(null);
  }
}
