import { DatePipe, Location } from '@angular/common';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { errorMessage } from '../../../core/http/error-message';
import { ConfirmService } from '../../../shared/ui/confirm.service';
import { Crumb, PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { ApplicationData, ApplicationDraft } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import { createApplicationForm, patchApplicationForm } from './application-form';
import { registrationNumberAvailable } from './application.validators';
import { DraftAutosaveService } from './draft-autosave.service';
import { BankingStepComponent } from './steps/banking-step.component';
import { BusinessStepComponent } from './steps/business-step.component';
import { ContactStepComponent } from './steps/contact-step.component';
import { OwnersStepComponent } from './steps/owners-step.component';
import { ReviewStepComponent } from './steps/review-step.component';
import { HasUnsavedChanges } from './unsaved-changes.guard';

export const WIZARD_STEPS = [
  { key: 'business', label: 'Business' },
  { key: 'contact', label: 'Contact' },
  { key: 'owners', label: 'Owners' },
  { key: 'banking', label: 'Banking' },
  { key: 'review', label: 'Review & submit' },
] as const;

const REVIEW_STEP = WIZARD_STEPS.length - 1;

/**
 * Multi-step merchant application. One typed FormGroup holds every step, so
 * state survives moving back and forth and auto-save always sees the whole form.
 *
 * Change detection: the app is zoneless and form state is not signal-based, so we
 * re-render on every form event (this also covers async validators finishing).
 */
@Component({
  selector: 'app-application-wizard',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    BusinessStepComponent,
    ContactStepComponent,
    OwnersStepComponent,
    BankingStepComponent,
    ReviewStepComponent,
    PageHeaderComponent,
  ],
  providers: [DraftAutosaveService],
  templateUrl: './application-wizard.component.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ApplicationWizardComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ApplicationsApi);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly autosave = inject(DraftAutosaveService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  /** Provided by the route resolver when editing an existing draft. */
  readonly draft = input<ApplicationDraft>();

  protected readonly steps = WIZARD_STEPS;
  protected readonly crumbs: Crumb[] = [
    { label: 'Overview', link: '/dashboard' },
    { label: 'Applications', link: '/applications' },
    { label: 'Application form' },
  ];
  protected readonly reviewStep = REVIEW_STEP;
  protected readonly currentStep = signal(0);
  protected readonly showErrorSummary = signal(false);
  protected readonly checking = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly reviewData = signal<ApplicationData | null>(null);

  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private submitted = false;

  readonly form = createApplicationForm(
    this.fb,
    registrationNumberAvailable(
      (value, excludeId) => this.api.isRegistrationNumberAvailable(value, excludeId),
      () => this.autosave.draftId(),
    ),
  );

  constructor() {
    // Once a new draft gets an id, swap /new for /:id/edit without re-creating the
    // component, so a page reload reopens the saved draft.
    effect(() => {
      const id = this.autosave.draftId();
      if (id && !this.draft()) this.location.replaceState(`/applications/${id}/edit`);
    });
  }

  ngOnInit(): void {
    this.form.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());

    const draft = this.draft();
    if (draft) {
      this.autosave.useExistingDraft(draft.id, draft.reference);
      patchApplicationForm(this.form, this.fb, draft.data);
    }

    // Connected after loading the draft, so the loaded values are the "already saved" baseline.
    this.autosave.connect(this.form.valueChanges, () => this.form.getRawValue(), this.destroyRef);
  }

  stepControl(index: number): AbstractControl | null {
    const { business, contact, owners, banking } = this.form.controls;
    return [business, contact, owners, banking][index] ?? null;
  }

  isStepValid(index: number): boolean {
    return this.stepControl(index)?.valid ?? this.form.valid;
  }

  /** Share of the four data steps that are currently valid (drives the progress bar). */
  progress(): number {
    const done = [0, 1, 2, 3].filter((i) => this.isStepValid(i)).length;
    return Math.round((done / 4) * 100);
  }

  /** A step is reachable when every step before it is valid. */
  canGoTo(index: number): boolean {
    return Array.from({ length: index }, (_, i) => i).every((i) => this.isStepValid(i));
  }

  next(): void {
    const control = this.stepControl(this.currentStep());
    if (control && !this.ensureValid(control, () => this.next())) return;
    this.goTo(this.currentStep() + 1);
  }

  back(): void {
    this.goTo(this.currentStep() - 1);
  }

  goTo(index: number): void {
    if (index < 0 || index > REVIEW_STEP || index === this.currentStep()) return;
    if (index > this.currentStep() && !this.canGoTo(index)) return;

    this.showErrorSummary.set(false);
    if (index === REVIEW_STEP) this.reviewData.set(this.form.getRawValue());
    this.currentStep.set(index);
    this.autosave.saveNow();
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  saveDraft(): void {
    this.autosave.saveNow();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      const firstInvalid = [0, 1, 2, 3].find((i) => !this.isStepValid(i)) ?? 0;
      this.form.markAllAsTouched();
      this.currentStep.set(firstInvalid);
      this.showErrorSummary.set(true);
      this.focusFirstInvalid();
      return;
    }

    const confirmed = await this.confirm.ask({
      title: 'Submit application?',
      message:
        'The application goes to review and can no longer be edited, unless the reviewer asks for more information.',
      confirmLabel: 'Submit for review',
    });
    if (!confirmed) return;

    this.submitting.set(true);
    this.submitError.set(null);
    this.autosave.submit().subscribe({
      next: (app) => {
        this.submitted = true;
        this.toasts.show(`Application ${app.reference} submitted for review.`);
        void this.router.navigate(['/applications', app.id]);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.submitError.set(
          errorMessage(err, 'Submission failed. Your answers are kept; please try again.'),
        );
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.submitted && this.autosave.hasUnsavedChanges();
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  /** Returns true if valid; otherwise reveals errors (or waits for async validation). */
  private ensureValid(control: AbstractControl, retry: () => void): boolean {
    if (control.pending) {
      this.checking.set(true);
      control.statusChanges
        .pipe(
          filter((s) => s !== 'PENDING'),
          take(1),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => {
          this.checking.set(false);
          retry();
        });
      return false;
    }
    if (control.valid) return true;

    control.markAllAsTouched();
    this.showErrorSummary.set(true);
    this.focusFirstInvalid();
    return false;
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const target =
          root.querySelector<HTMLElement>('.step-body .is-invalid') ??
          root.querySelector<HTMLElement>('#error-summary');
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
