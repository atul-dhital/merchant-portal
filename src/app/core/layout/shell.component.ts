import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { initials } from '../../shared/format';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import { ToastService } from '../../shared/ui/toast.service';
import { Permission, ROLE_INFO, ROLE_LABELS } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { RealtimeService, describeUpdate } from '../realtime/realtime.service';

interface NavItem {
  key: 'overview' | 'applications' | 'new';
  label: string;
  icon: IconName;
  link: string;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid', link: '/dashboard' },
  { key: 'applications', label: 'Applications', icon: 'file', link: '/applications' },
  {
    key: 'new',
    label: 'New application',
    icon: 'plus',
    link: '/applications/new',
    permission: 'application:create',
  },
];

const DESKTOP_QUERY = '(min-width: 992px)';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ShellComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly realtime = inject(RealtimeService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleInfo = ROLE_INFO;
  protected readonly devMode = isDevMode();
  protected readonly isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.userAgent ?? '');

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('globalSearch');
  private readonly userMenu = viewChild.required<ElementRef<HTMLElement>>('userMenu');
  private readonly userMenuButton = viewChild.required<ElementRef<HTMLElement>>('userMenuButton');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly navItems = computed(() =>
    NAV.filter((item) => !item.permission || this.auth.can(item.permission)),
  );

  /** Which sidebar item is current: detail pages count as "Applications", /new does not. */
  protected readonly activeKey = computed<NavItem['key'] | null>(() => {
    const path = this.url().split(/[?#]/)[0];
    if (path.startsWith('/dashboard')) return 'overview';
    if (path === '/applications/new') return 'new';
    if (path.startsWith('/applications')) return 'applications';
    return null;
  });

  protected readonly initials = computed(() => initials(this.auth.user()?.name));

  constructor() {
    // Tell the user when someone else changes an application they can see.
    this.realtime.applicationUpdates$
      .pipe(
        filter((update) => update.actorId !== this.auth.user()?.id),
        takeUntilDestroyed(),
      )
      .subscribe((update) => this.toasts.show(describeUpdate(update), 'info'));

    // Close the mobile drawer and menus after any navigation.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
        this.userMenuOpen.set(false);
      });
  }

  /** Desktop: collapse to an icon rail. Mobile: open the drawer. */
  toggleSidebar(): void {
    if (globalThis.matchMedia?.(DESKTOP_QUERY).matches) this.collapsed.update((c) => !c);
    else this.mobileOpen.update((o) => !o);
  }

  search(event: Event): void {
    const input = event.target as HTMLInputElement;
    const q = input.value.trim();
    void this.router.navigate(['/applications'], { queryParams: q ? { q } : {} });
    input.blur();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authService.logout();
  }

  /**
   * Dev-only helper: invalidates every access token on the mock API so the next
   * API calls receive 401 together, demonstrating the single shared refresh.
   */
  expireTokens(): void {
    this.userMenuOpen.set(false);
    this.http
      .post('/api/dev/expire-tokens', {})
      .subscribe(() =>
        this.toasts.show('Access tokens expired. The next request will refresh once.', 'info'),
      );
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput().nativeElement.focus();
    } else if (event.key === 'Escape') {
      if (this.userMenuOpen()) {
        this.userMenuOpen.set(false);
        this.userMenuButton().nativeElement.focus();
      }
      this.mobileOpen.set(false);
    }
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.userMenuOpen() && !this.userMenu().nativeElement.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }
}
