import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { REVIEWER, SALES } from '../../../testing/fixtures';
import { User } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { ShellComponent } from './shell.component';
import { ToastService } from '../../shared/ui/toast.service';
import { fakeRealtime, update } from '../../../testing/fake-realtime';

@Component({ template: 'page' })
class StubPageComponent {}

describe('ShellComponent', () => {
  let harness: RouterTestingHarness;
  let realtime: ReturnType<typeof fakeRealtime>;

  async function open(user: User, url = '/dashboard') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        (realtime = fakeRealtime()).provider,
        provideRouter([
          {
            path: '',
            component: ShellComponent,
            children: [
              { path: 'dashboard', component: StubPageComponent },
              { path: 'applications', component: StubPageComponent },
              { path: 'applications/new', component: StubPageComponent },
              { path: 'applications/:id', component: StubPageComponent },
            ],
          },
        ]),
      ],
    });
    TestBed.inject(AuthStore).setSession({ accessToken: 't', user });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
  }

  const el = () => harness.fixture.nativeElement as HTMLElement;
  const navLinks = () => [...el().querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main"] a')];
  const current = () => navLinks().find((a) => a.getAttribute('aria-current') === 'page');

  it('shows "New application" in the sidebar only for SALES', async () => {
    await open(SALES);
    expect(navLinks().map((a) => a.textContent?.trim())).toEqual([
      'Overview',
      'Applications',
      'New application',
    ]);
  });

  it('hides create actions for a REVIEWER', async () => {
    await open(REVIEWER);
    expect(navLinks().map((a) => a.textContent?.trim())).toEqual(['Overview', 'Applications']);
  });

  it('marks the current section: detail pages count as Applications, /new does not', async () => {
    await open(SALES, '/applications/app-1');
    expect(current()?.textContent).toContain('Applications');
    await harness.navigateByUrl('/applications/new');
    expect(current()?.textContent).toContain('New application');
  });

  it('searches applications from the header', async () => {
    await open(SALES);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const input = el().querySelector<HTMLInputElement>('#global-search')!;
    input.value = '  coffee ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navigate).toHaveBeenCalledWith(['/applications'], { queryParams: { q: 'coffee' } });
  });

  it('focuses the header search with Ctrl+K', async () => {
    await open(SALES);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(document.activeElement?.id).toBe('global-search');
  });

  it('opens the account menu, closes it with Escape and signs out from it', async () => {
    await open(SALES);
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockReturnValue(undefined);
    const trigger = el().querySelector<HTMLButtonElement>('[aria-controls="user-menu"]')!;

    trigger.click();
    await harness.fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await harness.fixture.whenStable();
    expect(el().querySelector('#user-menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    await harness.fixture.whenStable();
    [...el().querySelectorAll<HTMLButtonElement>('#user-menu button')]
      .find((b) => b.textContent?.includes('Sign out'))!
      .click();
    expect(logout).toHaveBeenCalled();
  });

  it('shows the live connection and toasts changes made by other users only', async () => {
    await open(SALES);
    expect(el().querySelector('.live-indicator')!.textContent).toContain('Live');
    const toasts = TestBed.inject(ToastService);

    realtime.updates.next(update({ actorId: SALES.id })); // own change: no toast
    expect(toasts.toasts()).toHaveLength(0);

    realtime.updates.next(update()); // Riya approved it
    expect(toasts.toasts()[0].message).toBe('MA-2026-0001 approved by Riya Reviewer');
  });
});
