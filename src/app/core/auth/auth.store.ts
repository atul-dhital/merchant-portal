import { Injectable, computed, signal } from '@angular/core';
import { AuthResponse, Permission, ROLE_PERMISSIONS, User } from './auth.models';

/**
 * Session state. The access token lives only in memory (never localStorage),
 * so an XSS payload cannot read a persisted token. The refresh token is an
 * httpOnly cookie that JavaScript cannot access at all.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null && this._accessToken() !== null);

  private readonly permissions = computed(
    () => new Set<Permission>(this._user() ? ROLE_PERMISSIONS[this._user()!.role] : []),
  );

  /** Reactive: reading it inside a template or computed tracks the session. */
  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  setSession({ accessToken, user }: AuthResponse): void {
    this._accessToken.set(accessToken);
    this._user.set(user);
  }

  clear(): void {
    this._accessToken.set(null);
    this._user.set(null);
  }
}
