import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ADMIN, OTHER_REVIEWER, REVIEWER, SALES, detail } from '../../../../testing/fixtures';
import { User } from '../../../core/auth/auth.models';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApplicationDetailComponent } from './application-detail.component';
import { fakeRealtime, update } from '../../../../testing/fake-realtime';

describe('ApplicationDetailComponent (permission-aware UI)', () => {
  let fixture: ComponentFixture<ApplicationDetailComponent>;
  let backend: HttpTestingController;
  let realtime: ReturnType<typeof fakeRealtime>;

  async function render(user: User) {
    TestBed.configureTestingModule({
      imports: [ApplicationDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        (realtime = fakeRealtime()).provider,
      ],
    });
    TestBed.inject(AuthStore).setSession({ accessToken: 't', user });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ApplicationDetailComponent);
    fixture.componentRef.setInput('id', 'app-001');
    fixture.detectChanges();
    backend.expectOne('/api/applications/app-001').flush(detail({ status: 'IN_REVIEW' }));
    await fixture.whenStable();
    // The admin's assignment panel loads reviewers.
    backend.match('/api/users?role=REVIEWER').forEach((r) => r.flush([REVIEWER, OTHER_REVIEWER]));
    await fixture.whenStable();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const revealButtons = () =>
    [...el().querySelectorAll('button')].filter((b) => b.textContent?.includes('Reveal'));

  afterEach(() => backend.verify());

  it('SALES: no review controls, no assignment, no reveal; sensitive data masked', async () => {
    await render(SALES);
    expect(el().querySelector('app-review-panel')).toBeNull();
    expect(el().querySelector('app-assignment-panel')).toBeNull();
    expect(revealButtons()).toHaveLength(0);
    expect(el().textContent).toContain('•••• 1234');
    expect(el().textContent).toContain('Risk history');
  });

  it('assigned REVIEWER: sees the review panel and reveal controls', async () => {
    await render(REVIEWER);
    expect(el().querySelector('app-review-panel')).not.toBeNull();
    expect(el().querySelector('app-assignment-panel')).toBeNull();
    expect(revealButtons().length).toBeGreaterThan(0);
  });

  it('a REVIEWER who is not assigned cannot decide', async () => {
    await render(OTHER_REVIEWER);
    expect(el().querySelector('app-review-panel')).toBeNull();
  });

  it('ADMIN: manages assignment but does not record decisions', async () => {
    await render(ADMIN);
    expect(el().querySelector('app-assignment-panel')).not.toBeNull();
    expect(el().querySelector('app-review-panel')).toBeNull();
    expect(revealButtons().length).toBeGreaterThan(0);
  });

  it('reloads live when someone else changes this application, not for own changes', async () => {
    await render(SALES);
    realtime.updates.next(update({ actorId: SALES.id })); // own action: already reloaded
    backend.expectNone('/api/applications/app-001');

    realtime.updates.next(update({ application: { ...update().application, id: 'app-999' } }));
    backend.expectNone('/api/applications/app-001'); // a different application

    realtime.updates.next(update()); // the reviewer decided on this one
    backend.expectOne('/api/applications/app-001').flush(detail({ status: 'APPROVED' }));
    await fixture.whenStable();
    expect(el().textContent).toContain('Approved');
  });
});
