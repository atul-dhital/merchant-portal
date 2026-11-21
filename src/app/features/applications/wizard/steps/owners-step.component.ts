import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ControlStateDirective } from '../../../../shared/forms/control-state.directive';
import { FieldErrorsComponent } from '../../../../shared/forms/field-errors.component';
import { OwnersArray, createOwnerGroup } from '../application-form';

export const MAX_OWNERS = 4;

@Component({
  selector: 'app-owners-step',
  imports: [ReactiveFormsModule, ControlStateDirective, FieldErrorsComponent],
  template: `
    @let owners = array();
    <p class="text-body-secondary">
      List every beneficial owner. Combined ownership cannot exceed 100%.
    </p>

    @if (owners.touched && owners.hasError('ownershipTotal')) {
      <div class="alert alert-danger py-2" role="alert">
        Total ownership is {{ owners.getError('ownershipTotal').actual }}%; it cannot exceed 100%.
      </div>
    }

    @for (owner of owners.controls; track owner; let i = $index) {
      <fieldset class="border rounded p-3 mb-3" [formGroup]="owner">
        <legend class="float-none w-auto px-2 fs-6 fw-semibold mb-0">Owner {{ i + 1 }}</legend>
        <div class="row g-3">
          <div class="col-md-6">
            <label [for]="'owner-' + i + '-fullName'" class="form-label"
              >Full name <span aria-hidden="true">*</span></label
            >
            <input
              [id]="'owner-' + i + '-fullName'"
              class="form-control"
              formControlName="fullName"
              required
              [attr.aria-describedby]="'owner-' + i + '-fullName-err'"
            />
            <app-field-errors
              [id]="'owner-' + i + '-fullName-err'"
              [control]="owner.controls.fullName"
            />
          </div>
          <div class="col-md-6">
            <label [for]="'owner-' + i + '-dob'" class="form-label"
              >Date of birth <span aria-hidden="true">*</span></label
            >
            <input
              [id]="'owner-' + i + '-dob'"
              type="date"
              class="form-control"
              formControlName="dateOfBirth"
              required
              [attr.aria-describedby]="'owner-' + i + '-dob-err'"
            />
            <app-field-errors
              [id]="'owner-' + i + '-dob-err'"
              [control]="owner.controls.dateOfBirth"
            />
          </div>
          <div class="col-md-6">
            <label [for]="'owner-' + i + '-pct'" class="form-label"
              >Ownership % <span aria-hidden="true">*</span></label
            >
            <input
              [id]="'owner-' + i + '-pct'"
              type="number"
              min="1"
              max="100"
              step="0.01"
              class="form-control"
              formControlName="ownershipPercent"
              required
              [attr.aria-describedby]="'owner-' + i + '-pct-err'"
            />
            <app-field-errors
              [id]="'owner-' + i + '-pct-err'"
              [control]="owner.controls.ownershipPercent"
            />
          </div>
          <div class="col-md-6">
            <label [for]="'owner-' + i + '-nid'" class="form-label">
              National ID number <span aria-hidden="true">*</span>
              <span class="badge rounded-pill badge-soft-warning ms-1">Sensitive</span>
            </label>
            <div class="input-group has-validation">
              <input
                [id]="'owner-' + i + '-nid'"
                [type]="visibleIds().has(i) ? 'text' : 'password'"
                class="form-control"
                formControlName="nationalId"
                autocomplete="off"
                spellcheck="false"
                required
                [attr.aria-describedby]="'owner-' + i + '-nid-err'"
              />
              <button
                type="button"
                class="btn btn-outline-secondary"
                [attr.aria-pressed]="visibleIds().has(i)"
                [attr.aria-controls]="'owner-' + i + '-nid'"
                (click)="toggleVisible(i)"
              >
                {{ visibleIds().has(i) ? 'Hide' : 'Show' }}
              </button>
            </div>
            <app-field-errors
              [id]="'owner-' + i + '-nid-err'"
              [control]="owner.controls.nationalId"
            />
          </div>
        </div>
        @if (owners.length > 1) {
          <button type="button" class="btn btn-sm btn-outline-danger mt-3" (click)="remove(i)">
            Remove owner {{ i + 1 }}
          </button>
        }
      </fieldset>
    }

    @if (owners.length < maxOwners) {
      <button type="button" class="btn btn-outline-primary" (click)="add()">
        Add another owner
      </button>
    }
  `,
})
export class OwnersStepComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly array = input.required<OwnersArray>();
  protected readonly maxOwners = MAX_OWNERS;
  /** Indexes whose sensitive ID is temporarily shown while typing. */
  protected readonly visibleIds = signal(new Set<number>());

  add(): void {
    this.array().push(createOwnerGroup(this.fb));
  }

  remove(index: number): void {
    this.array().removeAt(index);
    this.array().markAsTouched();
    this.visibleIds.set(new Set());
  }

  toggleVisible(index: number): void {
    const next = new Set(this.visibleIds());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.visibleIds.set(next);
  }
}
