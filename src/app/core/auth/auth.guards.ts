import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { Permission } from './auth.models';
import { AuthStore } from './auth.store';

/** Only accept same-origin, path-absolute return URLs (prevents open redirects). */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return '/dashboard';
  }
  return url;
}

export const authGuard: CanMatchFn = (_route, segments) => {
  if (inject(AuthStore).isAuthenticated()) return true;
  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl } });
};

export const guestGuard: CanMatchFn = () =>
  inject(AuthStore).isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;

export function permissionGuard(permission: Permission): CanActivateFn {
  return () =>
    inject(AuthStore).can(permission) ? true : inject(Router).createUrlTree(['/forbidden']);
}
