import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, map, merge, of, startWith, switchMap } from 'rxjs';
import { ROLE_LABELS, Role } from '../../core/auth/auth.models';
import { AuthStore } from '../../core/auth/auth.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { errorMessage } from '../../core/http/error-message';
import { initials, timeAgo } from '../../shared/format';
import { ErrorAlertComponent } from '../../shared/ui/error-alert.component';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { applicationActions } from '../applications/data-access/application-policy';
import {
  ApplicationStatus,
  Decision,
  sensitiveFieldLabel,
} from '../applications/data-access/application.models';
import { StatusBadgeComponent } from '../applications/ui/status-badge.component';
import { ActivityEvent, Overview, OverviewApi } from './overview.api';
import { ColumnChartComponent } from './ui/column-chart.component';
import { StatusMeterListComponent } from './ui/status-meter-list.component';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Overview };

interface Kpi {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
}

/** Role-specific wording for the "needs attention" card. */
const ATTENTION: Record<Role, { title: string; empty: string; status: ApplicationStatus }> = {
  SALES: {
    title: 'Continue where you left off',
    empty: 'No drafts or information requests. Nice work.',
    status: 'INFO_REQUESTED',
  },
  REVIEWER: {
    title: 'Waiting for your decision',
    empty: 'No applications are waiting for your review.',
    status: 'IN_REVIEW',
  },
  ADMIN: {
    title: 'Waiting for a reviewer',
    empty: 'Every submitted application has a reviewer.',
    status: 'SUBMITTED',
  },
};

const DECISION_VERBS: Record<Decision, string> = {
  APPROVE: 'approved',
  REJECT: 'rejected',
  REQUEST_INFO: 'requested more information on',
};

const SCOPE_LABEL: Record<Role, string> = {
  SALES: 'My applications',
  REVIEWER: 'Assigned to me',
  ADMIN: 'All applications',
};

@Component({
  selector: 'app-overview',
  imports: [
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    ErrorAlertComponent,
    IconComponent,
    StatusBadgeComponent,
    ColumnChartComponent,
    StatusMeterListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.component.html',
})
export class OverviewComponent {
  private readonly api = inject(OverviewApi);
  protected readonly auth = inject(AuthStore);

  private readonly retry$ = new Subject<void>();
  protected readonly state = toSignal(
    merge(
      this.retry$,
      // Live: refresh when an application the user can see changes.
      inject(RealtimeService).applicationUpdates$.pipe(debounceTime(300)),
    ).pipe(
      startWith(undefined),
      switchMap(() =>
        this.api.get().pipe(
          map((data): State => ({ status: 'ready', data })),
          catchError((err: unknown) => of<State>({ status: 'error', message: errorMessage(err) })),
          startWith<State>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  /** Chart or accessible table view of the monthly data. */
  protected readonly monthlyView = signal<'chart' | 'table'>('chart');
  protected readonly placeholders = [1, 2, 3, 4];
  protected readonly initials = initials;
  protected readonly timeAgo = timeAgo;

  private readonly role = computed<Role>(() => this.auth.user()?.role ?? 'SALES');
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return `Good ${part}, ${(this.auth.user()?.name ?? '').split(' ')[0]}`;
  });
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.role()]);
  protected readonly attentionCopy = computed(() => ATTENTION[this.role()]);

  protected readonly kpis = computed<Kpi[]>(() => {
    const state = this.state();
    if (state.status !== 'ready') return [];
    const { counts, monthly } = state.data;
    const n = (s: ApplicationStatus) => counts.byStatus[s] ?? 0;
    const decided = n('APPROVED') + n('REJECTED');
    const thisMonth = monthly.at(-1)?.created ?? 0;
    return [
      {
        label: SCOPE_LABEL[this.role()],
        value: String(counts.total),
        hint: `${thisMonth} new this month`,
        icon: 'file',
      },
      {
        label: 'Awaiting review',
        value: String(n('SUBMITTED') + n('IN_REVIEW')),
        hint: `${n('SUBMITTED')} unassigned · ${n('IN_REVIEW')} in review`,
        icon: 'clock',
      },
      {
        label: 'Info requested',
        value: String(n('INFO_REQUESTED')),
        hint: 'Waiting on the merchant',
        icon: 'inbox',
      },
      {
        label: 'Approval rate',
        value: decided ? `${Math.round((n('APPROVED') / decided) * 100)}%` : '—',
        hint: `${n('APPROVED')} approved · ${n('REJECTED')} rejected`,
        icon: 'percent',
      },
    ];
  });

  protected readonly monthlyData = computed(() => {
    const state = this.state();
    return state.status === 'ready'
      ? state.data.monthly.map((m) => ({ label: m.label, value: m.created }))
      : [];
  });

  retry(): void {
    this.retry$.next();
  }

  actionsFor(app: Overview['attention']['items'][number]) {
    return applicationActions(this.auth, app);
  }

  /** Activity sentence after the actor's name, e.g. "approved", "assigned … to Riya". */
  describe(event: ActivityEvent): string {
    switch (event.type) {
      case 'CREATED':
        return 'created';
      case 'SUBMITTED':
        return 'submitted';
      case 'ASSIGNED':
        return `assigned ${event.reviewerName} to`;
      case 'DECISION':
        return DECISION_VERBS[event.decision!];
      case 'SENSITIVE_REVEALED':
        return `viewed the ${sensitiveFieldLabel(event.field ?? '')} of`;
    }
  }
}
