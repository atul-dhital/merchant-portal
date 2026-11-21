import { Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ControlStateDirective } from '../../../../shared/forms/control-state.directive';
import { FieldErrorsComponent } from '../../../../shared/forms/field-errors.component';
import { ContactGroup } from '../application-form';
import { COUNTRIES } from '../form-options';

@Component({
  selector: 'app-contact-step',
  imports: [ReactiveFormsModule, ControlStateDirective, FieldErrorsComponent],
  template: `
    @let g = group();
    <div class="row g-3" [formGroup]="g">
      <div class="col-md-6">
        <label for="contactName" class="form-label"
          >Contact name <span aria-hidden="true">*</span></label
        >
        <input
          id="contactName"
          class="form-control"
          formControlName="contactName"
          autocomplete="name"
          required
          aria-describedby="contactName-err"
        />
        <app-field-errors id="contactName-err" [control]="g.controls.contactName" />
      </div>
      <div class="col-md-6">
        <label for="email" class="form-label">Email <span aria-hidden="true">*</span></label>
        <input
          id="email"
          type="email"
          class="form-control"
          formControlName="email"
          autocomplete="email"
          required
          aria-describedby="email-err"
        />
        <app-field-errors id="email-err" [control]="g.controls.email" />
      </div>
      <div class="col-md-6">
        <label for="phone" class="form-label">Phone <span aria-hidden="true">*</span></label>
        <input
          id="phone"
          type="tel"
          class="form-control"
          formControlName="phone"
          autocomplete="tel"
          required
          placeholder="+9779800000000"
          aria-describedby="phone-hint phone-err"
        />
        <div id="phone-hint" class="form-text">International format, starting with +.</div>
        <app-field-errors id="phone-err" [control]="g.controls.phone" />
      </div>
      <div class="col-md-6">
        <label for="addressLine1" class="form-label"
          >Street address <span aria-hidden="true">*</span></label
        >
        <input
          id="addressLine1"
          class="form-control"
          formControlName="addressLine1"
          autocomplete="address-line1"
          required
          aria-describedby="addressLine1-err"
        />
        <app-field-errors id="addressLine1-err" [control]="g.controls.addressLine1" />
      </div>
      <div class="col-md-4">
        <label for="city" class="form-label">City <span aria-hidden="true">*</span></label>
        <input
          id="city"
          class="form-control"
          formControlName="city"
          autocomplete="address-level2"
          required
          aria-describedby="city-err"
        />
        <app-field-errors id="city-err" [control]="g.controls.city" />
      </div>
      <div class="col-md-4">
        <label for="country" class="form-label">Country <span aria-hidden="true">*</span></label>
        <select
          id="country"
          class="form-select"
          formControlName="country"
          autocomplete="country"
          required
          aria-describedby="country-err"
        >
          <option value="" disabled>Select…</option>
          @for (c of countries; track c.value) {
            <option [value]="c.value">{{ c.label }}</option>
          }
        </select>
        <app-field-errors id="country-err" [control]="g.controls.country" />
      </div>
      <div class="col-md-4">
        <label for="postalCode" class="form-label"
          >Postal code <span aria-hidden="true">*</span></label
        >
        <input
          id="postalCode"
          class="form-control"
          formControlName="postalCode"
          autocomplete="postal-code"
          required
          [appGroupErrors]="['postalCodeFormat']"
          aria-describedby="postalCode-hint postalCode-err"
        />
        @if (postalHint(); as hint) {
          <div id="postalCode-hint" class="form-text">{{ hint }}</div>
        }
        <app-field-errors
          id="postalCode-err"
          [control]="g.controls.postalCode"
          [groupErrors]="['postalCodeFormat']"
        />
      </div>
    </div>
  `,
})
export class ContactStepComponent {
  readonly group = input.required<ContactGroup>();
  protected readonly countries = COUNTRIES;

  protected postalHint(): string | null {
    const country = this.group().controls.country.value;
    return COUNTRIES.find((c) => c.value === country)?.postalHint ?? null;
  }
}
