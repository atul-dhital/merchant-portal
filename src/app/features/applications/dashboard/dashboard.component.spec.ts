import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { REVIEWER, SALES, summary } from '../../../../testing/fixtures';
import { User } from '../../../core/auth/auth.models';
import { AuthStore } from '../../../core/auth/auth.store';
import { DashboardComponent } from './dashboard.component';
import { fakeRealtime, update } from '../../../../testing/fake-realtime';

describe('DashboardComponent', () => {
  let backend: HttpTestingController;
  let harness: RouterTestingHarness;
  let realtime: ReturnType<typeof fakeRealtime>;

  async function open(user: User, url = '/applications') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'applications', component: DashboardComponent }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        (realtime = fakeRealtime()).provider,
      ],
    });
    TestBed.inject(AuthStore).setSession({ accessToken: 't', user });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    TestBed.tick();
  }

  const text = () => harness.routeNativeElement!.textContent ?? '';
  const listRequest = () => backend.expectOne((r) => r.url === '/api/applications');
  const COUNTS_URL = '/api/applications/counts';
  const flushCounts = (byStatus: Record<string, number> = { DRAFT: 2, IN_REVIEW: 1 }) =>
    backend
      .match((r) => r.url === COUNTS_URL)
      .filter((r) => !r.cancelled) // superseded by a newer request (switchMap)
      .forEach((r) =>
        r.flush({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus }),
      );
  const chip = (label: string) =>
    [
      ...harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Filter by status"] button',
      ),
    ].find((b) => b.textContent?.trim().startsWith(label))!;
  const page = (items = [summary()], total = items.length) => ({
    items,
    total,
    page: 1,
    pageSize: 10,
  });

  afterEach(() => {
    flushCounts();
    backend.verify();
  });

  it('requests the page and filters taken from the URL (server-side pagination)', async () => {
    await open(SALES, '/applications?page=2&status=DRAFT&q=coffee&pageSize=20');
    const req = listRequest();
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('status')).toBe('DRAFT');
    expect(req.request.params.get('q')).toBe('coffee');
    req.flush(page());
    await harness.fixture.whenStable();

    // The filter controls reflect the URL on first load.
    const el = harness.routeNativeElement!;
    expect(chip('Draft').getAttribute('aria-pressed')).toBe('true');
    expect(chip('All').getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector<HTMLSelectElement>('#page-size')!.value).toBe('20');
    expect(el.querySelector<HTMLInputElement>('#search')!.value).toBe('coffee');
  });

  it('offers a way back when the page number is beyond the last page', async () => {
    await open(SALES, '/applications?page=99');
    listRequest().flush({ items: [], total: 12, page: 99, pageSize: 10 });
    await harness.fixture.whenStable();
    expect(text()).toContain('Go to first page');
    expect(text()).not.toContain('Showing');
  });

  it('shows skeleton rows, then the data', async () => {
    await open(SALES);
    expect(harness.routeNativeElement!.querySelector('.placeholder-glow')).not.toBeNull();
    listRequest().flush(page([summary({ reference: 'MA-2026-0099' })]));
    await harness.fixture.whenStable();
    expect(text()).toContain('MA-2026-0099');
    expect(text()).toContain('Showing 1–1 of 1 applications');
  });

  it('shows an error with a Retry button that reloads', async () => {
    await open(SALES);
    listRequest().flush(
      { message: 'Simulated service failure.' },
      { status: 503, statusText: 'Unavailable' },
    );
    await harness.fixture.whenStable();
    expect(text()).toContain('Simulated service failure.');

    const retry = [...harness.routeNativeElement!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Retry',
    )!;
    retry.click();
    TestBed.tick();
    listRequest().flush(page());
    await harness.fixture.whenStable();
    expect(text()).not.toContain('Simulated service failure.');
  });

  it('shows "New application" and "Continue editing" only to SALES on their own draft', async () => {
    await open(SALES);
    listRequest().flush(page([summary({ status: 'DRAFT' })]));
    await harness.fixture.whenStable();
    expect(text()).toContain('New application');
    expect(text()).toContain('Continue editing');
  });

  it('shows "Review" (not create/edit) to the assigned REVIEWER', async () => {
    await open(REVIEWER);
    listRequest().flush(page([summary({ status: 'IN_REVIEW' })]));
    await harness.fixture.whenStable();
    expect(text()).not.toContain('New application');
    expect(text()).not.toContain('Continue editing');
    expect(harness.routeNativeElement!.querySelector('a[href$="#review"]')).not.toBeNull();
  });

  it('shows live counts on the status chips and filters when a chip is clicked', async () => {
    await open(SALES, '/applications?q=coffee');
    const counts = backend.expectOne((r) => r.url === COUNTS_URL);
    expect(counts.request.params.get('q')).toBe('coffee'); // counts follow the search
    counts.flush({ total: 3, byStatus: { DRAFT: 2, IN_REVIEW: 1 } });
    listRequest().flush(page());
    await harness.fixture.whenStable();

    expect(chip('All').textContent).toContain('3');
    expect(chip('Draft').textContent).toContain('2');
    expect(chip('Rejected').textContent).toContain('0');

    chip('Draft').click();
    await harness.fixture.whenStable();
    const filtered = listRequest();
    expect(filtered.request.params.get('status')).toBe('DRAFT');
    expect(filtered.request.params.get('page')).toBe('1');
    filtered.flush(page());
    await harness.fixture.whenStable();
    expect(chip('Draft').getAttribute('aria-pressed')).toBe('true');
    backend.expectNone((r) => r.url === COUNTS_URL); // changing status does not refetch counts
  });

  it('focuses the search box when "/" is pressed', async () => {
    await open(SALES);
    listRequest().flush(page());
    await harness.fixture.whenStable();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement?.id).toBe('search');
  });

  it('reloads the list and the counts when a real-time update arrives', async () => {
    await open(SALES);
    listRequest().flush(page([summary({ status: 'IN_REVIEW' })]));
    flushCounts();
    await harness.fixture.whenStable();
    realtime.updates.next(update());
    await new Promise((r) => setTimeout(r, 350)); // debounce window

    listRequest().flush(page([summary({ status: 'APPROVED' })]));
    expect(backend.match((r) => r.url === COUNTS_URL).length).toBe(1);
    await harness.fixture.whenStable();
    expect(text()).toContain('Approved');
  });
});
