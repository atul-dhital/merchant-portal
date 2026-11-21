import {
  HttpContextToken,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

/** Marks a request that was already retried after a refresh, so we never loop. */
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

const API_PREFIX = '/api/';
const AUTH_PREFIX = '/api/auth/';

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * 1. Attaches the bearer token to our own API only (never to third-party URLs).
 * 2. On 401, refreshes the token ONCE even when many requests fail together
 *    (AuthService.refreshAccessToken shares one in-flight call), then retries
 *    each failed request once with the new token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  // Auth endpoints use the httpOnly refresh cookie, not the bearer token.
  if (!req.url.startsWith(API_PREFIX) || req.url.startsWith(AUTH_PREFIX)) {
    return next(req);
  }

  const store = inject(AuthStore);
  const auth = inject(AuthService);
  const sentToken = store.accessToken();

  return next(withBearer(req, sentToken)).pipe(
    catchError((error: unknown) => {
      const is401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!is401 || req.context.get(RETRIED_AFTER_REFRESH)) {
        return throwError(() => error);
      }

      const retry = (token: string) =>
        next(
          withBearer(req.clone({ context: req.context.set(RETRIED_AFTER_REFRESH, true) }), token),
        );

      // A refresh already finished while this request was in flight: just retry.
      const current = store.accessToken();
      if (current && current !== sentToken) {
        return retry(current);
      }
      return auth.refreshAccessToken().pipe(switchMap(retry));
    }),
  );
};
