import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  StatusCounts,
} from '../../applications/data-access/application.models';

/**
 * Applications by status as a meter list: name, share bar and count per row, in
 * workflow order (one hue; the names carry identity). Each row links to the
 * filtered list.
 */
@Component({
  selector: 'app-status-meter-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .row-link {
      display: block;
      padding: 0.5rem 0.625rem;
      margin: 0 -0.625rem;
      border-radius: 0.5rem;
      color: inherit;
      text-decoration: none;
    }
    .row-link:hover {
      background: var(--app-hover);
    }
    .track {
      height: 8px;
      margin-top: 0.375rem;
      border-radius: 999px;
      background: var(--app-track);
      overflow: hidden;
    }
    .fill {
      height: 100%;
      border-radius: 999px;
      background: var(--app-chart);
    }
    .figure {
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <ul class="list-unstyled mb-0">
      @for (row of rows(); track row.status) {
        <li>
          <a class="row-link" routerLink="/applications" [queryParams]="{ status: row.status }">
            <span class="d-flex justify-content-between small">
              <span class="text-body-emphasis">{{ row.label }}</span>
              <!-- Explicit space: Angular drops whitespace-only nodes, and screen readers would say "Draft1". -->
              {{ ' ' }}
              <span class="figure text-body-secondary">
                <span class="text-body-emphasis fw-semibold">{{ row.count }}</span> ·
                {{ row.share }}%
              </span>
            </span>
            <span class="visually-hidden">, show these applications</span>
            <span class="track d-block" aria-hidden="true">
              <span class="fill d-block" [style.width.%]="row.share"></span>
            </span>
          </a>
        </li>
      }
    </ul>
  `,
})
export class StatusMeterListComponent {
  readonly counts = input.required<StatusCounts>();

  protected readonly rows = computed(() => {
    const { total, byStatus } = this.counts();
    return APPLICATION_STATUSES.map((status) => {
      const count = byStatus[status] ?? 0;
      return {
        status,
        label: STATUS_LABELS[status],
        count,
        share: total ? Math.round((count / total) * 100) : 0,
      };
    });
  });
}
