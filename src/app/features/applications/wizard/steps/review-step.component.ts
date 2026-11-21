import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApplicationData } from '../../data-access/application.models';
import { maskValue } from '../../ui/mask';
import { BUSINESS_TYPES, CATEGORIES, COUNTRIES, labelOf } from '../form-options';

/** Read-only summary before submission. Sensitive values stay masked here too. */
@Component({
  selector: 'app-review-step',
  imports: [DecimalPipe],
  template: `
    @let d = data();
    <p class="text-body-secondary">
      Check the details below, then submit the application for review.
    </p>

    <div class="row g-3">
      <section class="col-lg-6" aria-labelledby="rv-business">
        <div class="d-flex justify-content-between align-items-center">
          <h3 id="rv-business" class="h6 mb-2">Business</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="editStep.emit(0)">
            Edit<span class="visually-hidden"> business details</span>
          </button>
        </div>
        <dl class="row small mb-0">
          <dt class="col-5">Legal name</dt>
          <dd class="col-7">{{ d.business.legalName }}</dd>
          <dt class="col-5">Trading name</dt>
          <dd class="col-7">{{ d.business.tradingName || '—' }}</dd>
          <dt class="col-5">Type</dt>
          <dd class="col-7">{{ label(businessTypes, d.business.businessType) }}</dd>
          <dt class="col-5">Category</dt>
          <dd class="col-7">{{ label(categories, d.business.category) }}</dd>
          <dt class="col-5">Registration no.</dt>
          <dd class="col-7">{{ d.business.registrationNumber }}</dd>
          <dt class="col-5">Incorporated</dt>
          <dd class="col-7">{{ d.business.incorporationDate }}</dd>
          <dt class="col-5">Website</dt>
          <dd class="col-7 text-break">{{ d.business.website || '—' }}</dd>
        </dl>
      </section>

      <section class="col-lg-6" aria-labelledby="rv-contact">
        <div class="d-flex justify-content-between align-items-center">
          <h3 id="rv-contact" class="h6 mb-2">Contact</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="editStep.emit(1)">
            Edit<span class="visually-hidden"> contact details</span>
          </button>
        </div>
        <dl class="row small mb-0">
          <dt class="col-5">Name</dt>
          <dd class="col-7">{{ d.contact.contactName }}</dd>
          <dt class="col-5">Email</dt>
          <dd class="col-7 text-break">{{ d.contact.email }}</dd>
          <dt class="col-5">Phone</dt>
          <dd class="col-7">{{ d.contact.phone }}</dd>
          <dt class="col-5">Address</dt>
          <dd class="col-7">
            {{ d.contact.addressLine1 }}, {{ d.contact.city }} {{ d.contact.postalCode }},
            {{ label(countries, d.contact.country) }}
          </dd>
        </dl>
      </section>

      <section class="col-lg-6" aria-labelledby="rv-owners">
        <div class="d-flex justify-content-between align-items-center">
          <h3 id="rv-owners" class="h6 mb-2">Owners</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="editStep.emit(2)">
            Edit<span class="visually-hidden"> owners</span>
          </button>
        </div>
        <ul class="list-unstyled small mb-0">
          @for (o of d.owners; track $index) {
            <li class="mb-1">
              <strong>{{ o.fullName }}</strong>, {{ o.ownershipPercent }}% · born
              {{ o.dateOfBirth }} · ID
              <span class="font-monospace-digits">{{ mask(o.nationalId) }}</span>
            </li>
          }
        </ul>
      </section>

      <section class="col-lg-6" aria-labelledby="rv-banking">
        <div class="d-flex justify-content-between align-items-center">
          <h3 id="rv-banking" class="h6 mb-2">Banking & processing</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="editStep.emit(3)">
            Edit<span class="visually-hidden"> banking details</span>
          </button>
        </div>
        <dl class="row small mb-0">
          <dt class="col-5">Bank</dt>
          <dd class="col-7">{{ d.banking.bankName }}</dd>
          <dt class="col-5">Account holder</dt>
          <dd class="col-7">{{ d.banking.accountHolder }}</dd>
          <dt class="col-5">Account no.</dt>
          <dd class="col-7 font-monospace-digits">{{ mask(d.banking.accountNumber) }}</dd>
          <dt class="col-5">Bank code</dt>
          <dd class="col-7">{{ d.banking.routingCode }}</dd>
          <dt class="col-5">Monthly volume</dt>
          <dd class="col-7">{{ d.banking.expectedMonthlyVolume | number }}</dd>
          <dt class="col-5">Average ticket</dt>
          <dd class="col-7">{{ d.banking.averageTicketSize | number }}</dd>
        </dl>
      </section>
    </div>
  `,
})
export class ReviewStepComponent {
  readonly data = input.required<ApplicationData>();
  readonly editStep = output<number>();

  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly categories = CATEGORIES;
  protected readonly countries = COUNTRIES;
  protected readonly label = labelOf;
  protected readonly mask = maskValue;
}
