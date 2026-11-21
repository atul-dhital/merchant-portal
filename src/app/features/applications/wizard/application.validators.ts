import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import { COUNTRIES } from './form-options';

/** FormArray validator: the owners' percentages may not add up to more than `max`. */
export function ownershipTotal(max = 100): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const owners = (control.value ?? []) as { ownershipPercent: number | null }[];
    const actual = owners.reduce((sum, o) => sum + (Number(o.ownershipPercent) || 0), 0);
    return actual > max ? { ownershipTotal: { actual, max } } : null;
  };
}

/** Group validator: average ticket size cannot exceed expected monthly volume. */
export function ticketNotAboveVolume(group: AbstractControl): ValidationErrors | null {
  const { expectedMonthlyVolume, averageTicketSize } = group.value as {
    expectedMonthlyVolume: number | null;
    averageTicketSize: number | null;
  };
  if (expectedMonthlyVolume == null || averageTicketSize == null) return null;
  return averageTicketSize > expectedMonthlyVolume ? { ticketAboveVolume: true } : null;
}

/** Group validator: postal code must match the selected country's format. */
export function postalCodeForCountry(group: AbstractControl): ValidationErrors | null {
  const { country, postalCode } = group.value as { country: string; postalCode: string };
  const rule = COUNTRIES.find((c) => c.value === country);
  if (!rule || !postalCode) return null;
  return rule.postalCode.test(postalCode.trim())
    ? null
    : { postalCodeFormat: { country: rule.label } };
}

export const REGISTRATION_CHECK_DEBOUNCE_MS = 400;

/**
 * Async validator: registration number must not be used by another application.
 * Angular unsubscribes the previous validation run on each keystroke, so the
 * `timer` acts as a debounce. Network errors don't block the user (the server
 * re-validates on submit).
 */
export function registrationNumberAvailable(
  check: (value: string, excludeId: string | null) => Observable<boolean>,
  excludeId: () => string | null,
): AsyncValidatorFn {
  return (control: AbstractControl<string | null>) => {
    const value = (control.value ?? '').trim();
    if (!value) return of(null);
    return timer(REGISTRATION_CHECK_DEBOUNCE_MS).pipe(
      switchMap(() => check(value, excludeId())),
      map((available) => (available ? null : { registrationTaken: true })),
      catchError(() => of(null)),
    );
  };
}
