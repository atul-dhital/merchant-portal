import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

const TONE_CLASSES = {
  success: 'text-bg-success',
  info: 'text-bg-dark',
  danger: 'text-bg-danger',
} as const;

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A single polite live region: screen readers announce each toast once.
  template: `
    <div
      class="toast-container position-fixed bottom-0 end-0 p-3"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast show border-0 fade-in" [class]="toneClass[toast.tone]">
          <div class="d-flex">
            <div class="toast-body">{{ toast.message }}</div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              aria-label="Dismiss notification"
              (click)="toasts.dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly toneClass = TONE_CLASSES;
}
