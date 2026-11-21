import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ApplicationStatus, STATUS_LABELS } from '../data-access/application.models';

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  DRAFT: 'badge-soft-secondary',
  SUBMITTED: 'badge-soft-info',
  IN_REVIEW: 'badge-soft-primary',
  INFO_REQUESTED: 'badge-soft-warning',
  APPROVED: 'badge-soft-success',
  REJECTED: 'badge-soft-danger',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge rounded-pill badge-dot" [class]="cssClass()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<ApplicationStatus>();
  readonly label = computed(() => STATUS_LABELS[this.status()]);
  readonly cssClass = computed(() => STATUS_CLASSES[this.status()]);
}
