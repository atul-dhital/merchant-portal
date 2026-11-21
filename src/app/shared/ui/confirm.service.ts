import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * App-wide confirmation dialog: `await confirm.ask({...})` resolves true/false.
 * Rendered once by ConfirmDialogComponent (native <dialog>, so focus trapping,
 * Esc to cancel and the backdrop come from the browser).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this._pending()?.resolve(false); // only one dialog at a time
    return new Promise((resolve) => this._pending.set({ ...options, resolve }));
  }

  close(confirmed: boolean): void {
    const pending = this._pending();
    this._pending.set(null);
    pending?.resolve(confirmed);
  }
}
