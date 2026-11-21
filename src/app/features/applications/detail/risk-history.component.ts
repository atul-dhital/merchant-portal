import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  DECISION_LABELS,
  HistoryEvent,
  RiskLevel,
  sensitiveFieldLabel,
} from '../data-access/application.models';

const RISK_CLASSES: Record<RiskLevel, string> = {
  LOW: 'badge-soft-success',
  MEDIUM: 'badge-soft-warning',
  HIGH: 'badge-soft-danger',
};

/** Timeline of risk decisions, assignments and sensitive-data access (newest first). */
@Component({
  selector: 'app-risk-history',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (events().length === 0) {
      <p class="text-body-secondary mb-0">No history yet.</p>
    } @else {
      <ol class="list-unstyled mb-0">
        @for (e of events(); track e.id) {
          <li
            class="border-start border-3 ps-3 pb-3"
            [class.border-primary]="e.type === 'DECISION'"
          >
            <div class="small text-body-secondary">
              <time [attr.datetime]="e.at">{{ e.at | date: 'medium' }}</time> · {{ e.actorName }}
            </div>
            @switch (e.type) {
              @case ('CREATED') {
                <div>Application created</div>
              }
              @case ('SUBMITTED') {
                <div>Submitted for review</div>
              }
              @case ('ASSIGNED') {
                <div>
                  Assigned to <strong>{{ e.reviewerName }}</strong>
                </div>
              }
              @case ('DECISION') {
                <div>
                  Decision: <strong>{{ decisionLabels[e.decision!] }}</strong>
                  @if (e.riskLevel) {
                    <span class="badge ms-1" [class]="riskClasses[e.riskLevel]"
                      >{{ e.riskLevel }} risk</span
                    >
                  }
                </div>
                @if (e.notes) {
                  <blockquote class="small bg-body-tertiary rounded p-2 mt-1 mb-0">
                    {{ e.notes }}
                  </blockquote>
                }
              }
              @case ('SENSITIVE_REVEALED') {
                <div class="small">Viewed {{ fieldLabel(e.field ?? '') }} (audited)</div>
              }
            }
          </li>
        }
      </ol>
    }
  `,
})
export class RiskHistoryComponent {
  readonly history = input.required<HistoryEvent[]>();
  protected readonly events = computed(() => [...this.history()].reverse());
  protected readonly decisionLabels = DECISION_LABELS;
  protected readonly riskClasses = RISK_CLASSES;
  protected readonly fieldLabel = sensitiveFieldLabel;
}
