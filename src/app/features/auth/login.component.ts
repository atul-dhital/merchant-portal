import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { ROLE_INFO, ROLE_ORDER, User } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/error-message';
import { initials } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';

type UsersState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; users: User[] };

@Component({
  selector: 'app-login',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the `?returnUrl=` query parameter. */
  readonly returnUrl = input<string>();

  protected readonly initials = initials;
  protected readonly signingInAs = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly users = toSignal(
    this.auth.demoUsers().pipe(
      map((users): UsersState => ({ status: 'ready', users })),
      catchError((err: unknown) => of<UsersState>({ status: 'error', message: errorMessage(err) })),
      startWith<UsersState>({ status: 'loading' }),
    ),
    { requireSync: true },
  );

  /** One card per account type, in a fixed order, with its demo account. */
  protected readonly accountTypes = computed(() => {
    const state = this.users();
    const users = state.status === 'ready' ? state.users : [];
    return ROLE_ORDER.map((role) => ({
      role,
      info: ROLE_INFO[role],
      users: users.filter((u) => u.role === role),
    })).filter((group) => group.users.length > 0);
  });

  signIn(user: User): void {
    this.signingInAs.set(user.id);
    this.error.set(null);
    this.auth.login(user.id).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (err: unknown) => {
        this.signingInAs.set(null);
        this.error.set(errorMessage(err, 'Sign-in failed. Please try again.'));
      },
    });
  }
}
