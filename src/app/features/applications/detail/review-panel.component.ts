import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { errorMessage } from '../../../core/http/error-message';
import { ControlStateDirective } from '../../../shared/forms/control-state.directive';
import { FieldErrorsComponent } from '../../../shared/forms/field-errors.component';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { DECISION_LABELS, Decision, RiskLevel } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';

/** Notes are mandatory (min. 10 chars) unless the decision is APPROVE. */
export function notesRequiredForDecision(group: AbstractControl): ValidationErrors | null {
  const { decision, notes } = group.value as { decision: Decision | ''; notes: string };
  if (!decision || decision === 'APPROVE') return null;
  return (notes ?? '').trim().length >= 10 ? null : { notesRequired: true };
}

@Component({
  selector: 'app-review-panel',
  imports: [ReactiveFormsModule, ControlStateDirective, FieldErrorsComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <!-- Radio inputs styled as buttons (Bootstrap btn-check): keyboard and screen readers
           still get a native radio group. -->
      <fieldset class="mb-3">
        <legend class="form-label fs-6">Decision <span aria-hidden="true">*</span></legend>
        <div class="d-grid gap-2">
          @for (d of decisions; track d.value) {
            <input
              class="btn-check"
              type="radio"
              [id]="'decision-' + d.value"
              [value]="d.value"
              formControlName="decision"
            />
            <label class="btn text-start" [class]="d.css" [for]="'decision-' + d.value">
              <span aria-hidden="true" class="me-1">{{ d.icon }}</span>
              {{ decisionLabels[d.value] }}
            </label>
          }
        </div>
        <app-field-errors [control]="form.controls.decision" />
      </fieldset>

      <fieldset class="mb-3">
        <legend class="form-label fs-6">Risk level <span aria-hidden="true">*</span></legend>
        <div class="btn-group w-100">
          @for (r of riskLevels; track r.value) {
            <input
              class="btn-check"
              type="radio"
              [id]="'risk-' + r.value"
              [value]="r.value"
              formControlName="riskLevel"
            />
            <label class="btn btn-sm" [class]="r.css" [for]="'risk-' + r.value">{{
              r.label
            }}</label>
          }
        </div>
        <app-field-errors [control]="form.controls.riskLevel" />
      </fieldset>

      <div class="mb-3">
        <label for="notes" class="form-label">
          Notes
          @if (notesRequired()) {
            <span aria-hidden="true">*</span>
          }
        </label>
        <textarea
          id="notes"
          rows="3"
          class="form-control"
          formControlName="notes"
          [appGroupErrors]="['notesRequired']"
          aria-describedby="notes-hint notes-err"
        ></textarea>
        <div id="notes-hint" class="form-text">
          Required when rejecting or requesting more information.
        </div>
        <app-field-errors
          id="notes-err"
          [control]="form.controls.notes"
          [groupErrors]="['notesRequired']"
        />
      </div>

      @if (error(); as message) {
        <div class="alert alert-danger" role="alert">{{ message }}</div>
      }

      <button type="submit" class="btn btn-primary" [disabled]="saving()">
        @if (saving()) {
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        }
        Record decision
      </button>
    </form>
  `,
})
export class ReviewPanelComponent {
  private readonly api = inject(ApplicationsApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly applicationId = input.required<string>();
  readonly decided = output<void>();

  protected readonly decisions: { value: Decision; icon: string; css: string }[] = [
    { value: 'APPROVE', icon: '✓', css: 'btn-choice-success' },
    { value: 'REQUEST_INFO', icon: '?', css: 'btn-choice-warning' },
    { value: 'REJECT', icon: '✕', css: 'btn-choice-danger' },
  ];
  protected readonly riskLevels: { value: RiskLevel; label: string; css: string }[] = [
    { value: 'LOW', label: 'Low', css: 'btn-choice-success' },
    { value: 'MEDIUM', label: 'Medium', css: 'btn-choice-warning' },
    { value: 'HIGH', label: 'High', css: 'btn-choice-danger' },
  ];
  protected readonly decisionLabels = DECISION_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notesRequired = signal(false);

  readonly form = this.fb.group(
    {
      decision: this.fb.control<Decision | ''>('', Validators.required),
      riskLevel: this.fb.control<RiskLevel | ''>('', Validators.required),
      notes: ['', Validators.maxLength(1000)],
    },
    { validators: [notesRequiredForDecision] },
  );

  constructor() {
    this.form.controls.decision.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((d) => this.notesRequired.set(!!d && d !== 'APPROVE'));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { decision, riskLevel, notes } = this.form.getRawValue();
    const label = DECISION_LABELS[decision as Decision];
    const confirmed = await this.confirm.ask({
      title: `${label}?`,
      message: `You are recording "${label}" with ${String(riskLevel).toLowerCase()} risk. This is added to the risk history and cannot be undone.`,
      confirmLabel: 'Record decision',
      tone: decision === 'REJECT' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    this.saving.set(true);
    this.error.set(null);
    this.api
      .decide(this.applicationId(), {
        decision: decision as Decision,
        riskLevel: riskLevel as RiskLevel,
        notes: notes.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.reset();
          this.toasts.show(`Decision recorded: ${label}.`);
          this.decided.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(errorMessage(err, 'Could not record the decision.'));
        },
      });
  }
}
