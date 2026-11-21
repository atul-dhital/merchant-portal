import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ADMIN, SALES } from '../../../testing/fixtures';
import { User } from '../../core/auth/auth.models';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let backend: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  async function render(returnUrl?: string, users: User[] = [SALES, ADMIN]) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.detectChanges();
    backend.expectOne('/api/auth/demo-users').flush(users);
    await fixture.whenStable();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const signInButton = (name: string) =>
    [...el().querySelectorAll<HTMLButtonElement>('section.account-card button')].find(
      (b) => b.textContent?.trim() === `Sign in as ${name}`,
    )!;

  afterEach(() => backend.verify());

  it('shows one card per account type, in order, with what it can do and its accounts', async () => {
    await render();
    const cards = [...el().querySelectorAll<HTMLElement>('section.account-card')];
    expect(cards.map((c) => c.querySelector('h2')!.textContent!.trim())).toEqual([
      'Sales',
      'Admin',
    ]); // fixture has one SALES and one ADMIN user; empty types are not shown
    expect(cards[0].textContent).toContain('Create and edit your own applications');
    expect(cards[0].textContent).toContain('Sam Sales');
    expect(cards[1].textContent).toContain('Assign and reassign reviewers');
    expect(cards[1].getAttribute('aria-labelledby')).toBe('type-ADMIN');
  });

  it('lays the account types out as cards in one row (three across from tablet width)', async () => {
    await render();
    expect(el().querySelector('.row.row-cols-1.row-cols-md-3')).not.toBeNull();
    expect(el().querySelectorAll('.row-cols-md-3 > .col > section.account-card')).toHaveLength(2);
  });

  it('offers exactly one sign-in button per account type, naming the account', async () => {
    await render();
    const buttons = [...el().querySelectorAll<HTMLButtonElement>('section.account-card button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Sign in as Sam Sales',
      'Sign in as Ada Admin',
    ]);
    expect(el().querySelector('section.account-card select')).toBeNull();
    buttons[1].click();
    expect(backend.expectOne('/api/auth/login').request.body).toEqual({ userId: ADMIN.id });
  });

  it('signs in and returns to the requested page', async () => {
    await render('/applications/app-001');
    signInButton('Sam Sales').click();
    backend.expectOne('/api/auth/login').flush({ accessToken: 't', user: SALES });
    expect(navigateByUrl).toHaveBeenCalledWith('/applications/app-001');
  });

  it('ignores an external returnUrl (open-redirect protection)', async () => {
    await render('//evil.example');
    signInButton('Ada Admin').click();
    backend.expectOne('/api/auth/login').flush({ accessToken: 't', user: ADMIN });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error and re-enables the buttons when sign-in fails', async () => {
    await render();
    signInButton('Sam Sales').click();
    backend
      .expectOne('/api/auth/login')
      .flush({ message: 'Unknown demo user.' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Unknown demo user.');
    expect(signInButton('Sam Sales').disabled).toBe(false);
  });
});
