import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Route,
  Router,
  RouterStateSnapshot,
  UrlSegment,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { ADMIN, REVIEWER, SALES } from '../../../testing/fixtures';
import { User } from './auth.models';
import { authGuard, guestGuard, permissionGuard, safeReturnUrl } from './auth.guards';
import { AuthStore } from './auth.store';

describe('auth guards', () => {
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  const signIn = (user: User) => store.setSession({ accessToken: 't', user });
  const run = <T>(fn: () => T) => TestBed.runInInjectionContext(fn);
  const url = (result: unknown) => router.serializeUrl(result as UrlTree);

  describe('authGuard', () => {
    const segments = [new UrlSegment('applications', {}), new UrlSegment('new', {})];

    it('redirects anonymous users to /login with a returnUrl', () => {
      const result = run(() => authGuard({} as Route, segments));
      expect(url(result)).toBe('/login?returnUrl=%2Fapplications%2Fnew');
    });

    it('lets signed-in users through', () => {
      signIn(SALES);
      expect(run(() => authGuard({} as Route, segments))).toBe(true);
    });
  });

  it('guestGuard sends signed-in users away from /login', () => {
    expect(run(() => guestGuard({} as Route, []))).toBe(true);
    signIn(ADMIN);
    expect(url(run(() => guestGuard({} as Route, [])))).toBe('/dashboard');
  });

  describe('permissionGuard', () => {
    const guard = permissionGuard('application:create');
    const check = () => run(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

    it.each([
      [SALES, true],
      [REVIEWER, false],
      [ADMIN, false],
    ])('application:create for %o → allowed=%s', (user, allowed) => {
      signIn(user);
      const result = check();
      if (allowed) expect(result).toBe(true);
      else expect(url(result)).toBe('/forbidden');
    });
  });

  describe('safeReturnUrl', () => {
    it.each([
      ['/applications/app-1', '/applications/app-1'],
      ['//evil.example', '/dashboard'],
      ['/\\evil.example', '/dashboard'],
      ['https://evil.example', '/dashboard'],
      [undefined, '/dashboard'],
    ])('%s → %s', (input, expected) => {
      expect(safeReturnUrl(input)).toBe(expected);
    });
  });
});
