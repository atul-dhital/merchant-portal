import { Directive, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Applied to every reactive form control: adds Bootstrap's `is-invalid` class and
 * `aria-invalid` once the user has touched an invalid field, so screen readers and
 * sighted users get the same signal. `appGroupErrors` also flags cross-field errors
 * that the parent group owns (e.g. postal code vs. country).
 */
@Directive({
  // Intentionally matches Angular's own form directives so every field gets it automatically.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[formControlName],[formControl]',
  host: {
    '[class.is-invalid]': 'invalid',
    '[attr.aria-invalid]': 'invalid ? "true" : null',
  },
})
export class ControlStateDirective {
  private readonly ngControl = inject(NgControl, { self: true });
  readonly appGroupErrors = input<string[]>([]);

  get invalid(): boolean {
    const control = this.ngControl.control;
    if (!control?.touched) return false;
    return !!control.invalid || this.appGroupErrors().some((key) => control.parent?.hasError(key));
  }
}
