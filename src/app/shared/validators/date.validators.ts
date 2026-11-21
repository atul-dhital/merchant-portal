import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Today's date as YYYY-MM-DD in local time (matches <input type="date"> values). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function notInFuture(control: AbstractControl<string | null>): ValidationErrors | null {
  const value = control.value;
  return value && value > todayIso() ? { notInFuture: true } : null;
}

export function minAge(years: number): ValidatorFn {
  return (control: AbstractControl<string | null>) => {
    const value = control.value;
    if (!value) return null;
    const birth = new Date(`${value}T00:00:00`);
    const now = new Date();
    const cutoff = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
    return birth > cutoff ? { minAge: { requiredAge: years } } : null;
  };
}
