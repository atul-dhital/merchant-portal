import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, filter, map, startWith, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { errorMessage } from '../../../core/http/error-message';
import { ErrorAlertComponent } from '../../../shared/ui/error-alert.component';
import { Crumb, PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { applicationActions } from '../data-access/application-policy';
import { ApplicationDetail, SensitiveField } from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { BUSINESS_TYPES, CATEGORIES, COUNTRIES, labelOf } from '../wizard/form-options';
import { AssignmentPanelComponent } from './assignment-panel.component';
import { MaskedValueComponent } from './masked-value.component';
import { ReviewPanelComponent } from './review-panel.component';
import { RiskHistoryComponent } from './risk-history.component';

@Component({
  selector: 'app-application-detail',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    StatusBadgeComponent,
    ErrorAlertComponent,
    MaskedValueComponent,
    RiskHistoryComponent,
    ReviewPanelComponent,
    AssignmentPanelComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-detail.component.html',
})
export class ApplicationDetailComponent {
  private readonly api = inject(ApplicationsApi);
  private readonly auth = inject(AuthStore);

  /** Route param, bound via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly detail = signal<ApplicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<{ message: string; notFound: boolean } | null>(null);
  private readonly reload$ = new Subject<void>();

  /** Permission-aware UI. The API enforces the same rules independently. */
  protected readonly actions = computed(() => {
    const app = this.detail();
    return app
      ? applicationActions(this.auth, app)
      : { canEdit: false, canDecide: false, canAssign: false, canReveal: false };
  });

  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Overview', link: '/dashboard' },
    { label: 'Applications', link: '/applications' },
    { label: this.detail()?.reference ?? 'Application' },
  ]);

  protected readonly label = labelOf;
  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly categories = CATEGORIES;
  protected readonly countries = COUNTRIES;
  protected readonly accountField: SensitiveField = 'banking.accountNumber';

  constructor() {
    // Live: reload when someone else changes this application (own actions reload already).
    inject(RealtimeService)
      .applicationUpdates$.pipe(
        filter((u) => u.application.id === this.id() && u.actorId !== this.auth.user()?.id),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());

    // Opening another application clears the page; reloading the same one keeps the
    // current data on screen until the fresh copy arrives (revealed values survive it).
    toObservable(this.id)
      .pipe(
        tap(() => this.detail.set(null)),
        switchMap((id) =>
          this.reload$.pipe(
            startWith(undefined),
            map(() => id),
          ),
        ),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((id) =>
          this.api.get(id).pipe(
            catchError((err: unknown) => {
              this.loading.set(false);
              this.error.set({
                message: errorMessage(err, 'Could not load the application.'),
                notFound: err instanceof HttpErrorResponse && err.status === 404,
              });
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      });
  }

  reload(): void {
    this.reload$.next();
  }

  ownerField(index: number): SensitiveField {
    return `owners.${index}.nationalId`;
  }
}
