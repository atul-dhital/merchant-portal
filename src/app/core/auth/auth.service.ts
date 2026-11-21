import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthResponse, User } from './auth.models';
import { ToastService, ToastTone } from '../../shared/ui/toast.service';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** The single in-flight refresh shared by every request that hit a 401. */
  private refreshInFlight$: Observable<string> | null = null;

  demoUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/auth/demo-users');
  }

  login(userId: string): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/login', { userId }).pipe(
      tap((res) => this.store.setSession(res)),
      map((res) => res.user),
    );
  }

  /**
   * Returns a fresh access token. Concurrent callers share ONE POST /auth/refresh:
   * the first caller creates the request, later callers join it via shareReplay.
   * Once it settles the slot is cleared so a later expiry can refresh again.
   */
  refreshAccessToken(): Observable<string> {
    this.refreshInFlight$ ??= this.http.post<AuthResponse>('/api/auth/refresh', {}).pipe(
      tap((res) => this.store.setSession(res)),
      map((res) => res.accessToken),
      catchError((err: unknown) => {
        this.endSession('Your session has expired. Please sign in again.', 'info');
        return throwError(() => err);
      }),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  /** Called on app start: silently restores a session from the refresh cookie. */
  restoreSession(): Observable<unknown> {
    return this.http.post<AuthResponse>('/api/auth/refresh', {}).pipe(
      tap((res) => this.store.setSession(res)),
      catchError(() => of(null)),
    );
  }

  logout(): void {
    this.http
      .post('/api/auth/logout', {})
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.endSession('You have signed out.', 'success')),
      )
      .subscribe();
  }

  private endSession(message: string, tone: ToastTone): void {
    this.store.clear();
    void this.router.navigate(['/login']);
    this.toasts.show(message, tone);
  }
}
