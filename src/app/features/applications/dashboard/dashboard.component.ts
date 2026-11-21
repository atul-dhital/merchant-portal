import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  filter,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { errorMessage } from '../../../core/http/error-message';
import { ErrorAlertComponent } from '../../../shared/ui/error-alert.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { Crumb, PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { applicationActions } from '../data-access/application-policy';
import {
  APPLICATION_STATUSES,
  ApplicationQuery,
  ApplicationStatus,
  ApplicationSummary,
  Page,
  STATUS_LABELS,
  StatusCounts,
} from '../data-access/application.models';
import { ApplicationsApi } from '../data-access/applications.api';
import { StatusBadgeComponent } from '../ui/status-badge.component';
import { RowActionsComponent } from './row-actions.component';

export const PAGE_SIZES = [10, 20, 50] as const;

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; page: Page<ApplicationSummary> };

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * The URL query string is the single source of truth for page/filters, so the
 * view is shareable and survives reload and back/forward navigation.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    StatusBadgeComponent,
    PaginationComponent,
    ErrorAlertComponent,
    RowActionsComponent,
    PageHeaderComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class DashboardComponent {
  private readonly api = inject(ApplicationsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthStore);

  // Query params, bound via withComponentInputBinding().
  readonly page = input<string>();
  readonly pageSize = input<string>();
  readonly status = input<string>();
  readonly q = input<string>();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly crumbs: Crumb[] = [
    { label: 'Overview', link: '/dashboard' },
    { label: 'Applications' },
  ];
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  readonly query = computed<ApplicationQuery>(() => {
    const size = toPositiveInt(this.pageSize(), 10);
    const status = this.status() ?? '';
    return {
      page: toPositiveInt(this.page(), 1),
      pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : 10,
      status: (APPLICATION_STATUSES as readonly string[]).includes(status)
        ? (status as ApplicationStatus)
        : '',
      q: (this.q() ?? '').trim(),
    };
  });

  private readonly retry$ = new Subject<void>();

  /** Reload on Retry, and when a real-time update arrives (bursts are coalesced). */
  private readonly refresh$ = merge(
    this.retry$,
    inject(RealtimeService).applicationUpdates$.pipe(debounceTime(300)),
  ).pipe(startWith(undefined));

  /** switchMap cancels a stale request when filters change mid-flight. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.query), this.refresh$]).pipe(
      switchMap(([query]) =>
        this.api.list(query).pipe(
          map((page): ListState => ({ status: 'success', page })),
          catchError((err: unknown) =>
            of<ListState>({ status: 'error', message: errorMessage(err) }),
          ),
          startWith<ListState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ListState },
  );

  /** Only the search term affects counts, so paging or picking a status doesn't refetch them. */
  private readonly searchTerm = computed(() => this.query().q);

  /** Counts per status for the chips. Failure is non-blocking: chips just show no numbers. */
  protected readonly counts = toSignal(
    combineLatest([toObservable(this.searchTerm), this.refresh$]).pipe(
      switchMap(([q]) => this.api.counts(q).pipe(catchError(() => of<StatusCounts | null>(null)))),
    ),
    { initialValue: null },
  );

  protected readonly statusChips = computed(() => {
    const counts = this.counts();
    return [
      { value: '' as const, label: 'All', count: counts?.total },
      ...APPLICATION_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
        count: counts ? (counts.byStatus[status] ?? 0) : undefined,
      })),
    ];
  });

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  /** Last successful page, kept while the next one loads to avoid layout jumps. */
  protected readonly lastPage = linkedSignal<ListState, Page<ApplicationSummary> | null>({
    source: this.state,
    computation: (state, previous) =>
      state.status === 'success' ? state.page : (previous?.value ?? null),
  });

  protected readonly rows = computed(() =>
    (this.lastPage()?.items ?? []).map((item) => ({
      item,
      actions: applicationActions(this.auth, item),
    })),
  );

  protected readonly rangeLabel = computed(() => {
    const page = this.lastPage();
    if (!page || page.items.length === 0) return '';
    const from = (page.page - 1) * page.pageSize + 1;
    const to = Math.min(page.total, page.page * page.pageSize);
    return `Showing ${from}–${to} of ${page.total} applications`;
  });

  protected readonly hasFilters = computed(() => !!this.query().status || !!this.query().q);

  /** e.g. ?page=99 after rows were removed: offer a way back instead of an empty table. */
  protected readonly pageOutOfRange = computed(() => {
    const page = this.lastPage();
    return !!page && page.total > 0 && page.items.length === 0;
  });

  /** Last search term this component wrote to the URL. */
  private pushedSearch = '';

  constructor() {
    // Keep the search box in sync when the URL changes from outside (back/forward, links),
    // but never overwrite what the user is typing with the echo of our own navigation.
    effect(() => {
      const q = this.query().q;
      if (q !== this.pushedSearch && q !== this.searchControl.value.trim()) {
        this.pushedSearch = q;
        this.searchControl.setValue(q, { emitEvent: false });
      }
    });

    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        filter((q) => q !== this.query().q),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        this.pushedSearch = q;
        this.updateQuery({ q, page: 1 });
      });
  }

  selectStatus(status: ApplicationStatus | ''): void {
    if (status !== this.query().status) this.updateQuery({ status, page: 1 });
  }

  /** "/" jumps to the search box (unless the user is already typing somewhere). */
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.searchInput().nativeElement.focus();
    }
  }

  onPageSizeChange(event: Event): void {
    this.updateQuery({ pageSize: Number((event.target as HTMLSelectElement).value), page: 1 });
  }

  onPageChange(page: number): void {
    this.updateQuery({ page });
  }

  retry(): void {
    this.retry$.next();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.updateQuery({ status: '', q: '', page: 1 });
  }

  private updateQuery(patch: Partial<Record<keyof ApplicationQuery, string | number>>): void {
    // Empty values and defaults are removed from the URL to keep it clean.
    const queryParams = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        value === '' || (key === 'page' && value === 1) || (key === 'pageSize' && value === 10)
          ? null
          : value,
      ]),
    );
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
