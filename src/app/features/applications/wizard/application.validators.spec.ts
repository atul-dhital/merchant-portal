import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { minAge, notInFuture, todayIso } from '../../../shared/validators/date.validators';
import {
  REGISTRATION_CHECK_DEBOUNCE_MS,
  ownershipTotal,
  postalCodeForCountry,
  registrationNumberAvailable,
  ticketNotAboveVolume,
} from './application.validators';

describe('application validators', () => {
  describe('ownershipTotal', () => {
    const owners = (...pcts: (number | null)[]) =>
      new FormArray(pcts.map((p) => new FormGroup({ ownershipPercent: new FormControl(p) })));

    it('passes when the total is at most 100%', () => {
      expect(ownershipTotal(100)(owners(60, 40))).toBeNull();
      expect(ownershipTotal(100)(owners(50, null))).toBeNull();
    });

    it('fails with the actual total when above 100%', () => {
      expect(ownershipTotal(100)(owners(70, 40))).toEqual({
        ownershipTotal: { actual: 110, max: 100 },
      });
    });
  });

  describe('ticketNotAboveVolume', () => {
    const banking = (volume: number | null, ticket: number | null) =>
      new FormGroup({
        expectedMonthlyVolume: new FormControl(volume),
        averageTicketSize: new FormControl(ticket),
      });

    it('fails when the average ticket exceeds monthly volume', () => {
      expect(ticketNotAboveVolume(banking(1000, 1500))).toEqual({ ticketAboveVolume: true });
    });

    it('passes when within volume or incomplete', () => {
      expect(ticketNotAboveVolume(banking(1000, 1000))).toBeNull();
      expect(ticketNotAboveVolume(banking(null, 50))).toBeNull();
    });
  });

  describe('postalCodeForCountry', () => {
    const contact = (country: string, postalCode: string) =>
      new FormGroup({ country: new FormControl(country), postalCode: new FormControl(postalCode) });

    it.each([
      ['NP', '44600', true],
      ['NP', '4460', false],
      ['IN', '110001', true],
      ['GB', 'SW1A 1AA', true],
      ['US', '94105-1234', true],
      ['US', 'ABCDE', false],
    ])('%s %s → valid=%s', (country, code, valid) => {
      const result = postalCodeForCountry(contact(country, code));
      expect(result === null).toBe(valid);
    });
  });

  describe('date validators', () => {
    it('notInFuture rejects tomorrow and accepts today', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(notInFuture(new FormControl(todayIso(tomorrow)))).toEqual({ notInFuture: true });
      expect(notInFuture(new FormControl(todayIso()))).toBeNull();
    });

    it('minAge(18) rejects people younger than 18', () => {
      const now = new Date();
      const seventeen = todayIso(new Date(now.getFullYear() - 17, now.getMonth(), now.getDate()));
      const thirty = todayIso(new Date(now.getFullYear() - 30, 0, 1));
      expect(minAge(18)(new FormControl(seventeen))).toEqual({ minAge: { requiredAge: 18 } });
      expect(minAge(18)(new FormControl(thirty))).toBeNull();
    });
  });

  describe('registrationNumberAvailable (async)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const run = (check: () => Observable<boolean>, value: string) => {
      const spy = vi.fn(check);
      const validator = registrationNumberAvailable(spy, () => 'app-9');
      const result = firstValueFrom(validator(new FormControl(value)) as Observable<unknown>);
      return { spy, result };
    };

    it('debounces, then reports a taken number', async () => {
      const { spy, result } = run(() => of(false), 'TEST-1');
      expect(spy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(REGISTRATION_CHECK_DEBOUNCE_MS);
      expect(spy).toHaveBeenCalledWith('TEST-1', 'app-9');
      expect(await result).toEqual({ registrationTaken: true });
    });

    it('passes when available, and does not block the user on network errors', async () => {
      const ok = run(() => of(true), 'TEST-2');
      const failing = run(() => throwError(() => new Error('offline')), 'TEST-3');
      await vi.advanceTimersByTimeAsync(REGISTRATION_CHECK_DEBOUNCE_MS);
      expect(await ok.result).toBeNull();
      expect(await failing.result).toBeNull();
    });
  });
});
