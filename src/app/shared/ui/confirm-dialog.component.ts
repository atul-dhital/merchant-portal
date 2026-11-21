import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="app-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="$event.preventDefault(); confirm.close(false)"
    >
      @if (confirm.pending(); as c) {
        <div class="p-4">
          <h2 id="confirm-title" class="h5 mb-2">{{ c.title }}</h2>
          <p id="confirm-message" class="text-body-secondary mb-4">{{ c.message }}</p>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" (click)="confirm.close(false)">
              {{ c.cancelLabel ?? 'Cancel' }}
            </button>
            <button
              type="button"
              class="btn"
              [class.btn-primary]="(c.tone ?? 'primary') === 'primary'"
              [class.btn-danger]="c.tone === 'danger'"
              (click)="confirm.close(true)"
            >
              {{ c.confirmLabel ?? 'Confirm' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // After render, so the buttons exist and showModal() focuses the first one (Cancel).
    afterRenderEffect(() => {
      const el = this.dialog().nativeElement;
      const open = this.confirm.pending() !== null;
      if (open && !el.open) {
        // showModal() traps focus and makes the rest of the page inert.
        if (typeof el.showModal === 'function') el.showModal();
        else el.setAttribute('open', '');
      } else if (!open && el.open) {
        if (typeof el.close === 'function') el.close();
        else el.removeAttribute('open');
      }
    });
  }
}
