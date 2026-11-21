import { Component, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ControlStateDirective } from '../../../../shared/forms/control-state.directive';
import { FieldErrorsComponent } from '../../../../shared/forms/field-errors.component';
import { BankingGroup } from '../application-form';

@Component({
  selector: 'app-banking-step',
  imports: [ReactiveFormsModule, ControlStateDirective, FieldErrorsComponent],
  template: `
    @let g = group();
    <div class="row g-3" [formGroup]="g">
      <div class="col-md-6">
        <label for="bankName" class="form-label">Bank name <span aria-hidden="true">*</span></label>
        <input
          id="bankName"
          class="form-control"
          formControlName="bankName"
          required
          aria-describedby="bankName-err"
        />
        <app-field-errors id="bankName-err" [control]="g.controls.bankName" />
      </div>
      <div class="col-md-6">
        <label for="accountHolder" class="form-label"
          >Account holder name <span aria-hidden="true">*</span></label
        >
        <input
          id="accountHolder"
          class="form-control"
          formControlName="accountHolder"
          required
          aria-describedby="accountHolder-err"
        />
        <app-field-errors id="accountHolder-err" [control]="g.controls.accountHolder" />
      </div>
      <div class="col-md-6">
        <label for="accountNumber" class="form-label">
          Account number <span aria-hidden="true">*</span>
          <span class="badge rounded-pill badge-soft-warning ms-1">Sensitive</span>
        </label>
        <div class="input-group has-validation">
          <input
            id="accountNumber"
            [type]="showAccount() ? 'text' : 'password'"
            inputmode="numeric"
            class="form-control"
            formControlName="accountNumber"
            autocomplete="off"
            spellcheck="false"
            required
            aria-describedby="accountNumber-hint accountNumber-err"
          />
          <button
            type="button"
            class="btn btn-outline-secondary"
            [attr.aria-pressed]="showAccount()"
            aria-controls="accountNumber"
            (click)="showAccount.set(!showAccount())"
          >
            {{ showAccount() ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div id="accountNumber-hint" class="form-text">8–20 digits.</div>
        <app-field-errors id="accountNumber-err" [control]="g.controls.accountNumber" />
      </div>
      <div class="col-md-6">
        <label for="routingCode" class="form-label"
          >Bank / SWIFT code <span aria-hidden="true">*</span></label
        >
        <input
          id="routingCode"
          class="form-control"
          formControlName="routingCode"
          required
          aria-describedby="routingCode-hint routingCode-err"
        />
        <div id="routingCode-hint" class="form-text">6–11 letters or digits.</div>
        <app-field-errors id="routingCode-err" [control]="g.controls.routingCode" />
      </div>
      <div class="col-md-6">
        <label for="expectedMonthlyVolume" class="form-label">
          Expected monthly volume <span aria-hidden="true">*</span>
        </label>
        <input
          id="expectedMonthlyVolume"
          type="number"
          min="1"
          class="form-control"
          formControlName="expectedMonthlyVolume"
          required
          aria-describedby="expectedMonthlyVolume-err"
        />
        <app-field-errors
          id="expectedMonthlyVolume-err"
          [control]="g.controls.expectedMonthlyVolume"
        />
      </div>
      <div class="col-md-6">
        <label for="averageTicketSize" class="form-label"
          >Average ticket size <span aria-hidden="true">*</span></label
        >
        <input
          id="averageTicketSize"
          type="number"
          min="1"
          class="form-control"
          formControlName="averageTicketSize"
          required
          [appGroupErrors]="['ticketAboveVolume']"
          aria-describedby="averageTicketSize-err"
        />
        <app-field-errors
          id="averageTicketSize-err"
          [control]="g.controls.averageTicketSize"
          [groupErrors]="['ticketAboveVolume']"
        />
      </div>
    </div>
  `,
})
export class BankingStepComponent {
  readonly group = input.required<BankingGroup>();
  protected readonly showAccount = signal(false);
}
