import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SALES } from '../../../testing/fixtures';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

describe('AuthService', () => {
  let service: AuthService;
  let store: AuthStore;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    store = TestBed.inject(AuthStore);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  it('login stores the session in memory', async () => {
    const result = firstValueFrom(service.login(SALES.id));
    const req = backend.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ userId: SALES.id });
    req.flush({ accessToken: 'tok', user: SALES });
    expect(await result).toEqual(SALES);
    expect(store.accessToken()).toBe('tok');
    expect(store.can('application:create')).toBe(true);
  });

  it('restoreSession signs the user in from the refresh cookie', async () => {
    const done = firstValueFrom(service.restoreSession());
    backend.expectOne('/api/auth/refresh').flush({ accessToken: 'tok', user: SALES });
    await done;
    expect(store.isAuthenticated()).toBe(true);
  });

  it('restoreSession treats "no session" as anonymous, not as an error', async () => {
    const done = firstValueFrom(service.restoreSession());
    backend.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(done).resolves.toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('logout clears the session and returns to login even if the API call fails', () => {
    store.setSession({ accessToken: 'tok', user: SALES });
    service.logout();
    backend.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Error' });
    expect(store.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
