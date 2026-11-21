import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert alert-danger d-flex flex-wrap align-items-center gap-2 mb-0" role="alert">
      <span class="flex-grow-1">{{ message() }}</span>
      @if (retryable()) {
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="retry.emit()">
          Retry
        </button>
      }
    </div>
  `,
})
export class ErrorAlertComponent {
  readonly message = input.required<string>();
  readonly retryable = input(true);
  readonly retry = output<void>();
}
