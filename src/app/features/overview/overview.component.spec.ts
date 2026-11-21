import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ADMIN, REVIEWER, SALES, summary } from '../../../testing/fixtures';
import { User } from '../../core/auth/auth.models';
import { AuthStore } from '../../core/auth/auth.store';
import { Overview } from './overview.api';
import { OverviewComponent } from './overview.component';
import { fakeRealtime, update } from '../../../testing/fake-realtime';

const OVERVIEW: Overview = {
  counts: {
    total: 10,
    byStatus: { DRAFT: 2, SUBMITTED: 1, IN_REVIEW: 3, INFO_REQUESTED: 1, APPROVED: 2, REJECTED: 1 },
  },
  monthly: [
    { month: '2026-10', label: 'Oct', created: 4 },
    { month: '2026-11', label: 'Nov', created: 6 },
  ],
  attention: { total: 1, items: [summary({ id: 'app-7', status: 'IN_REVIEW' })] },
  activity: [
    {
      id: 'e1',
      at: new Date().toISOString(),
      type: 'DECISION',
      actorName: 'Riya Reviewer',
      decision: 'REJECT',
      riskLevel: 'HIGH',
      applicationId: 'app-7',
      reference: 'MA-2026-0007',
      merchant: 'Test Merchant',
    },
  ],
};

describe('OverviewComponent', () => {
  let fixture: ComponentFixture<OverviewComponent>;
  let backend: HttpTestingController;
  let realtime: ReturnType<typeof fakeRealtime>;

  async function render(user: User, response: Overview | 'error' = OVERVIEW) {
    TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        (realtime = fakeRealtime()).provider,
      ],
    });
    TestBed.inject(AuthStore).setSession({ accessToken: 't', user });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OverviewComponent);
    await fixture.whenStable();
    const req = backend.expectOne('/api/overview');
    if (response === 'error') {
      req.flush({ message: 'Simulated service failure.' }, { status: 503, statusText: 'x' });
    } else {
      req.flush(response);
    }
    await fixture.whenStable();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  afterEach(() => backend.verify());

  it('shows KPI tiles computed from the scoped counts', async () => {
    await render(ADMIN);
    const tiles = [...el().querySelectorAll('[aria-label="Key figures"] .card')].map(
      (c) => c.textContent ?? '',
    );
    expect(tiles[0]).toContain('All applications');
    expect(tiles[0]).toContain('10');
    expect(tiles[0]).toContain('6 new this month');
    expect(tiles[1]).toContain('4'); // submitted + in review
    expect(tiles[3]).toContain('67%'); // 2 approved of 3 decided
  });

  it('uses role-specific wording for the attention list', async () => {
    await render(REVIEWER);
    expect(text()).toContain('Waiting for your decision');
    expect(text()).toContain('Assigned to me');
    expect(el().querySelector('a[href$="#review"]')).not.toBeNull();
  });

  it('describes activity in plain language', async () => {
    await render(SALES);
    expect(text()).toContain('Riya Reviewer');
    expect(text()).toContain('rejected');
    expect(text()).toContain('just now');
    expect(text()).toContain('Continue where you left off');
  });

  it('switches the monthly chart to an accessible table', async () => {
    await render(ADMIN);
    expect(el().querySelector('app-column-chart')).not.toBeNull();
    const tableButton = [...el().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Table',
    )!;
    tableButton.click();
    await fixture.whenStable();
    expect(el().querySelector('app-column-chart')).toBeNull();
    expect(tableButton.getAttribute('aria-pressed')).toBe('true');
    expect(el().querySelector('caption')!.textContent).toContain('New applications per month');
    expect(text()).toContain('Nov 2026');
  });

  it('shows an error with retry', async () => {
    await render(ADMIN, 'error');
    expect(text()).toContain('Simulated service failure.');
    [...el().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Retry')!.click();
    await fixture.whenStable();
    backend.expectOne('/api/overview').flush(OVERVIEW);
    await fixture.whenStable();
    expect(text()).toContain('All applications');
  });

  it('refreshes itself when a real-time update arrives', async () => {
    await render(ADMIN);
    realtime.updates.next(update());
    realtime.updates.next(update()); // bursts are coalesced
    await new Promise((r) => setTimeout(r, 350)); // debounce window
    backend.expectOne('/api/overview').flush(OVERVIEW);
  });
});
