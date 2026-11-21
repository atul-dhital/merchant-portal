import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../../shared/ui/confirm.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving the wizard while a change is unsaved or a save is in flight. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  inject(ConfirmService).ask({
    title: 'Leave without saving?',
    message: 'Your latest changes have not been saved yet. If you leave now, they will be lost.',
    confirmLabel: 'Leave page',
    cancelLabel: 'Stay',
    tone: 'danger',
  });
