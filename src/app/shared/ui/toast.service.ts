import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'danger';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export const TOAST_DURATION_MS = 5000;

/** Short, non-blocking feedback after an action ("Decision recorded"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, tone: ToastTone = 'success', durationMs = TOAST_DURATION_MS): void {
    const toast: Toast = { id: this.nextId++, message, tone };
    // Keep at most 3 on screen.
    this._toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
