import { Component, input } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Human-readable messages for every validator key used in the app. */
const MESSAGES: Record<string, (e: ValidationErrors[string]) => string> = {
  required: () => 'This field is required.',
  email: () => 'Enter a valid email address.',
  minlength: (e) => `Enter at least ${e.requiredLength} characters.`,
  maxlength: (e) => `Enter no more than ${e.requiredLength} characters.`,
  min: (e) => `Must be at least ${e.min}.`,
  max: (e) => `Must be at most ${e.max}.`,
  pattern: () => 'The format is not valid.',
  notInFuture: () => 'Date cannot be in the future.',
  minAge: (e) => `Must be at least ${e.requiredAge} years old.`,
  registrationTaken: () => 'This registration number is already used by another application.',
  postalCodeFormat: (e) => `Postal code format is not valid for ${e.country}.`,
  ownershipTotal: (e) => `Total ownership is ${e.actual}%; it cannot exceed ${e.max}%.`,
  ticketAboveVolume: () => 'Average ticket size cannot exceed the expected monthly volume.',
  notesRequired: () => 'Notes of at least 10 characters are required for this decision.',
};

/**
 * Shows the first error of a control once the user has interacted with it.
 * `groupErrors` lets a field also display a cross-field error owned by its parent group.
 * Not OnPush on purpose: control state is not signal-based, so it refreshes with its parent.
 */
@Component({
  selector: 'app-field-errors',
  host: { class: 'd-block' },
  template: `
    @if (message(); as msg) {
      <div class="invalid-feedback d-block">{{ msg }}</div>
    }
  `,
})
export class FieldErrorsComponent {
  readonly control = input.required<AbstractControl>();
  /** Keys of parent-group errors to show under this field. */
  readonly groupErrors = input<string[]>([]);

  message(): string | null {
    const control = this.control();
    if (!control.touched) return null;
    const errors: ValidationErrors = { ...control.errors };
    for (const key of this.groupErrors()) {
      const groupError = control.parent?.errors?.[key];
      if (groupError) errors[key] = groupError;
    }
    const key = Object.keys(errors)[0];
    if (!key) return null;
    return MESSAGES[key]?.(errors[key]) ?? 'This value is not valid.';
  }
}
