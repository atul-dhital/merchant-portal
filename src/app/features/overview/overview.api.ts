import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApplicationSummary,
  HistoryEvent,
  StatusCounts,
} from '../applications/data-access/application.models';

export interface MonthlyPoint {
  month: string;
  label: string;
  created: number;
}

export type ActivityEvent = HistoryEvent & {
  applicationId: string;
  reference: string;
  merchant: string;
};

/** Everything on the overview page, already scoped to the user by the API. */
export interface Overview {
  counts: StatusCounts;
  monthly: MonthlyPoint[];
  attention: { total: number; items: ApplicationSummary[] };
  activity: ActivityEvent[];
}

@Injectable({ providedIn: 'root' })
export class OverviewApi {
  private readonly http = inject(HttpClient);

  get(): Observable<Overview> {
    return this.http.get<Overview>('/api/overview');
  }
}
