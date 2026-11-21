import { AsyncValidatorFn, NonNullableFormBuilder, Validators } from '@angular/forms';
import { minAge, notInFuture } from '../../../shared/validators/date.validators';
import { ApplicationData, Owner } from '../data-access/application.models';
import {
  ownershipTotal,
  postalCodeForCountry,
  ticketNotAboveVolume,
} from './application.validators';

const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/; // E.164
const REGISTRATION_PATTERN = /^[A-Z0-9-]{5,20}$/i;
const NATIONAL_ID_PATTERN = /^[A-Z0-9-]{6,20}$/i;
const ACCOUNT_NUMBER_PATTERN = /^\d{8,20}$/;
const ROUTING_PATTERN = /^[A-Z0-9]{6,11}$/i;

export function createOwnerGroup(fb: NonNullableFormBuilder, owner?: Partial<Owner>) {
  return fb.group({
    fullName: [owner?.fullName ?? '', [Validators.required, Validators.maxLength(100)]],
    dateOfBirth: [owner?.dateOfBirth ?? '', [Validators.required, minAge(18)]],
    ownershipPercent: fb.control<number | null>(owner?.ownershipPercent ?? null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100),
    ]),
    nationalId: [
      owner?.nationalId ?? '',
      [Validators.required, Validators.pattern(NATIONAL_ID_PATTERN)],
    ],
  });
}

/** Typed Reactive Form for the whole wizard; one nested group per step. */
export function createApplicationForm(
  fb: NonNullableFormBuilder,
  registrationCheck: AsyncValidatorFn,
) {
  return fb.group({
    business: fb.group({
      legalName: ['', [Validators.required, Validators.maxLength(120)]],
      tradingName: ['', [Validators.maxLength(120)]],
      businessType: ['', [Validators.required]],
      registrationNumber: fb.control('', {
        validators: [Validators.required, Validators.pattern(REGISTRATION_PATTERN)],
        asyncValidators: [registrationCheck],
      }),
      incorporationDate: ['', [Validators.required, notInFuture]],
      website: ['', [Validators.pattern(URL_PATTERN)]],
      category: ['', [Validators.required]],
    }),
    contact: fb.group(
      {
        contactName: ['', [Validators.required, Validators.maxLength(100)]],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
        addressLine1: ['', [Validators.required, Validators.maxLength(150)]],
        city: ['', [Validators.required, Validators.maxLength(80)]],
        country: ['', [Validators.required]],
        postalCode: ['', [Validators.required]],
      },
      { validators: [postalCodeForCountry] },
    ),
    owners: fb.array([createOwnerGroup(fb)], {
      validators: [Validators.required, ownershipTotal(100)],
    }),
    banking: fb.group(
      {
        bankName: ['', [Validators.required, Validators.maxLength(100)]],
        accountHolder: ['', [Validators.required, Validators.maxLength(120)]],
        accountNumber: ['', [Validators.required, Validators.pattern(ACCOUNT_NUMBER_PATTERN)]],
        routingCode: ['', [Validators.required, Validators.pattern(ROUTING_PATTERN)]],
        expectedMonthlyVolume: fb.control<number | null>(null, [
          Validators.required,
          Validators.min(1),
        ]),
        averageTicketSize: fb.control<number | null>(null, [
          Validators.required,
          Validators.min(1),
        ]),
      },
      { validators: [ticketNotAboveVolume] },
    ),
  });
}

export type ApplicationForm = ReturnType<typeof createApplicationForm>;
export type BusinessGroup = ApplicationForm['controls']['business'];
export type ContactGroup = ApplicationForm['controls']['contact'];
export type OwnersArray = ApplicationForm['controls']['owners'];
export type BankingGroup = ApplicationForm['controls']['banking'];

/**
 * Loads saved draft data into the form, rebuilding the owners array to the right length.
 * Call it BEFORE subscribing to the form (auto-save), so these changes are not saved back.
 * Events are emitted on purpose: async validators (registration check) then report their
 * result through `statusChanges`, which the zoneless view needs in order to re-render.
 */
export function patchApplicationForm(
  form: ApplicationForm,
  fb: NonNullableFormBuilder,
  data: Partial<ApplicationData> | null | undefined,
): void {
  if (!data) return;
  const owners = data.owners?.length ? data.owners : [{}];
  form.controls.owners.clear({ emitEvent: false });
  owners.forEach((o) => form.controls.owners.push(createOwnerGroup(fb, o), { emitEvent: false }));
  form.patchValue({ business: data.business, contact: data.contact, banking: data.banking });
}
