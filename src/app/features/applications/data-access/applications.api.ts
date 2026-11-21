import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { User } from '../../../core/auth/auth.models';
import {
  ApplicationData,
  ApplicationDetail,
  ApplicationDraft,
  ApplicationQuery,
  ApplicationSummary,
  DecisionRequest,
  Page,
  SaveResult,
  SensitiveField,
  StatusCounts,
} from './application.models';

const BASE = '/api/applications';

@Injectable({ providedIn: 'root' })
export class ApplicationsApi {
  private readonly http = inject(HttpClient);

  list(query: ApplicationQuery): Observable<Page<ApplicationSummary>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.status) params = params.set('status', query.status);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<Page<ApplicationSummary>>(BASE, { params });
  }

  counts(q: string): Observable<StatusCounts> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<StatusCounts>(`${BASE}/counts`, { params });
  }

  get(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${BASE}/${encodeURIComponent(id)}`);
  }

  getDraft(id: string): Observable<ApplicationDraft> {
    return this.http.get<ApplicationDraft>(`${BASE}/${encodeURIComponent(id)}/draft`);
  }

  createDraft(data: ApplicationData): Observable<SaveResult> {
    return this.http.post<SaveResult>(BASE, { data });
  }

  saveDraft(id: string, data: ApplicationData): Observable<SaveResult> {
    return this.http.put<SaveResult>(`${BASE}/${encodeURIComponent(id)}/draft`, { data });
  }

  submit(id: string, data: ApplicationData): Observable<ApplicationSummary> {
    return this.http.post<ApplicationSummary>(`${BASE}/${encodeURIComponent(id)}/submit`, { data });
  }

  assign(id: string, reviewerId: string): Observable<ApplicationSummary> {
    return this.http.put<ApplicationSummary>(`${BASE}/${encodeURIComponent(id)}/assignment`, {
      reviewerId,
    });
  }

  decide(id: string, body: DecisionRequest): Observable<ApplicationSummary> {
    return this.http.post<ApplicationSummary>(`${BASE}/${encodeURIComponent(id)}/decision`, body);
  }

  reveal(id: string, field: SensitiveField): Observable<string> {
    return this.http
      .post<{ value: string }>(`${BASE}/${encodeURIComponent(id)}/reveal`, { field })
      .pipe(map((res) => res.value));
  }

  reviewers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users', { params: { role: 'REVIEWER' } });
  }

  isRegistrationNumberAvailable(value: string, excludeId: string | null): Observable<boolean> {
    let params = new HttpParams().set('value', value);
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http
      .get<{ available: boolean }>('/api/validation/registration-number', { params })
      .pipe(map((res) => res.available));
  }
}
