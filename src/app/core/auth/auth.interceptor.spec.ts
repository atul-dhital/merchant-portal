import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SALES } from '../../../testing/fixtures';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';

const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    store.setSession({ accessToken: 'old-token', user: SALES });
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token to API requests', () => {
    http.get('/api/applications').subscribe();
    const req = backend.expectOne('/api/applications');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old-token');
    req.flush({});
  });

  it('never sends the token to auth endpoints or other origins', () => {
    http.post('/api/auth/refresh', {}).subscribe();
    http.get('https://third-party.example/data').subscribe();
    expect(backend.expectOne('/api/auth/refresh').request.headers.has('Authorization')).toBe(false);
    expect(
      backend.expectOne('https://third-party.example/data').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('refreshes ONCE when several concurrent requests get 401, then retries each with the new token', () => {
    const urls = ['/api/a', '/api/b', '/api/c'];
    const results: string[] = [];
    urls.forEach((url) => http.get<string>(url).subscribe((body) => results.push(body)));

    // All three fail together with the expired token.
    urls.forEach((url) => backend.expectOne(url).flush(null, UNAUTHORIZED));

    // Exactly one refresh call (expectOne fails if there were two).
    backend.expectOne('/api/auth/refresh').flush({ accessToken: 'new-token', user: SALES });

    // Each original request is retried once with the new token.
    urls.forEach((url) => {
      const retry = backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
      retry.flush(url);
    });

    expect(results.sort()).toEqual(urls);
    expect(store.accessToken()).toBe('new-token');
  });

  it('does not refresh again for a 401 that arrives after a refresh already succeeded', () => {
    let body: unknown;
    http.get('/api/slow').subscribe((b) => (body = b));
    const slow = backend.expectOne('/api/slow');

    // Meanwhile another request refreshed the session.
    store.setSession({ accessToken: 'new-token', user: SALES });
    slow.flush(null, UNAUTHORIZED);

    backend.expectNone('/api/auth/refresh');
    const retry = backend.expectOne('/api/slow');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush('ok');
    expect(body).toBe('ok');
  });

  it('retries a request only once (no refresh loop)', () => {
    let status: number | undefined;
    http.get('/api/a').subscribe({ error: (e: { status: number }) => (status = e.status) });

    backend.expectOne('/api/a').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush({ accessToken: 'new-token', user: SALES });
    backend.expectOne('/api/a').flush(null, UNAUTHORIZED);

    backend.expectNone('/api/auth/refresh');
    expect(status).toBe(401);
  });

  it('ends the session and redirects to login when the refresh fails', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const errors: number[] = [];
    ['/api/a', '/api/b'].forEach((url) =>
      http.get(url).subscribe({ error: (e: { status: number }) => errors.push(e.status) }),
    );

    backend.expectOne('/api/a').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/b').flush(null, UNAUTHORIZED);
    backend.expectOne('/api/auth/refresh').flush(null, UNAUTHORIZED);

    expect(errors).toEqual([401, 401]);
    expect(store.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('passes non-401 errors through untouched', () => {
    let status: number | undefined;
    http.get('/api/a').subscribe({ error: (e: { status: number }) => (status = e.status) });
    backend.expectOne('/api/a').flush(null, { status: 403, statusText: 'Forbidden' });
    backend.expectNone('/api/auth/refresh');
    expect(status).toBe(403);
  });
});
