import { Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ControlStateDirective } from '../../../../shared/forms/control-state.directive';
import { FieldErrorsComponent } from '../../../../shared/forms/field-errors.component';
import { todayIso } from '../../../../shared/validators/date.validators';
import { BusinessGroup } from '../application-form';
import { BUSINESS_TYPES, CATEGORIES } from '../form-options';

@Component({
  selector: 'app-business-step',
  imports: [ReactiveFormsModule, ControlStateDirective, FieldErrorsComponent],
  template: `
    @let g = group();
    <div class="row g-3" [formGroup]="g">
      <div class="col-md-6">
        <label for="legalName" class="form-label"
          >Legal business name <span aria-hidden="true">*</span></label
        >
        <input
          id="legalName"
          class="form-control"
          formControlName="legalName"
          autocomplete="organization"
          required
          aria-describedby="legalName-err"
        />
        <app-field-errors id="legalName-err" [control]="g.controls.legalName" />
      </div>
      <div class="col-md-6">
        <label for="tradingName" class="form-label">Trading name</label>
        <input
          id="tradingName"
          class="form-control"
          formControlName="tradingName"
          aria-describedby="tradingName-err"
        />
        <app-field-errors id="tradingName-err" [control]="g.controls.tradingName" />
      </div>
      <div class="col-md-6">
        <label for="businessType" class="form-label"
          >Business type <span aria-hidden="true">*</span></label
        >
        <select
          id="businessType"
          class="form-select"
          formControlName="businessType"
          required
          aria-describedby="businessType-err"
        >
          <option value="" disabled>Select…</option>
          @for (o of businessTypes; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
        <app-field-errors id="businessType-err" [control]="g.controls.businessType" />
      </div>
      <div class="col-md-6">
        <label for="category" class="form-label"
          >Business category <span aria-hidden="true">*</span></label
        >
        <select
          id="category"
          class="form-select"
          formControlName="category"
          required
          aria-describedby="category-err"
        >
          <option value="" disabled>Select…</option>
          @for (o of categories; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
        <app-field-errors id="category-err" [control]="g.controls.category" />
      </div>
      <div class="col-md-6">
        <label for="registrationNumber" class="form-label">
          Registration number <span aria-hidden="true">*</span>
        </label>
        <div class="position-relative">
          <input
            id="registrationNumber"
            class="form-control"
            formControlName="registrationNumber"
            required
            aria-describedby="registrationNumber-hint registrationNumber-err"
          />
          @if (g.controls.registrationNumber.pending) {
            <span
              class="spinner-border spinner-border-sm text-secondary position-absolute top-50 end-0 translate-middle"
              role="status"
              ><span class="visually-hidden">Checking availability…</span></span
            >
          }
        </div>
        <div id="registrationNumber-hint" class="form-text">5–20 letters, digits or dashes.</div>
        <app-field-errors id="registrationNumber-err" [control]="g.controls.registrationNumber" />
      </div>
      <div class="col-md-6">
        <label for="incorporationDate" class="form-label">
          Incorporation date <span aria-hidden="true">*</span>
        </label>
        <input
          id="incorporationDate"
          type="date"
          class="form-control"
          formControlName="incorporationDate"
          required
          [max]="today"
          aria-describedby="incorporationDate-err"
        />
        <app-field-errors id="incorporationDate-err" [control]="g.controls.incorporationDate" />
      </div>
      <div class="col-12">
        <label for="website" class="form-label">Website</label>
        <input
          id="website"
          type="url"
          class="form-control"
          formControlName="website"
          placeholder="https://"
          autocomplete="url"
          aria-describedby="website-err"
        />
        <app-field-errors id="website-err" [control]="g.controls.website" />
      </div>
    </div>
  `,
})
export class BusinessStepComponent {
  readonly group = input.required<BusinessGroup>();
  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly categories = CATEGORIES;
  protected readonly today = todayIso();
}
