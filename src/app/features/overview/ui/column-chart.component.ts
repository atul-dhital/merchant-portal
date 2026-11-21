import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { niceScale } from '../../../shared/format';

export interface ColumnDatum {
  label: string;
  value: number;
}

/**
 * Single-series column chart in plain HTML/CSS (responsive, CSP-safe, no library).
 * One hue, hairline gridlines, rounded data-ends, value on the latest column only;
 * every column shows its value on hover and keyboard focus.
 */
@Component({
  selector: 'app-column-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .chart {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0 0.75rem;
    }
    .y-axis {
      position: relative;
      height: var(--plot-h);
      min-width: 1.5rem;
      font-size: 0.75rem;
      color: var(--app-muted);
      font-variant-numeric: tabular-nums;
    }
    .y-axis span {
      position: absolute;
      right: 0;
      transform: translateY(50%);
    }
    .plot {
      position: relative;
      height: var(--plot-h);
    }
    .grid-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--app-grid);
    }
    .columns {
      position: absolute;
      inset: 0;
      display: flex;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .slot {
      position: relative;
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      cursor: default;
      border-radius: 0.375rem;
      outline-offset: -2px;
    }
    .bar {
      width: min(24px, 60%);
      background: var(--app-chart);
      border-radius: 4px 4px 0 0;
      transition: filter 0.15s ease;
    }
    .slot:hover .bar,
    .slot:focus-visible .bar {
      filter: brightness(1.15);
    }
    .cap {
      position: absolute;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--bs-emphasis-color);
      transform: translateY(-100%);
      padding-bottom: 0.25rem;
    }
    .tip {
      position: absolute;
      left: 50%;
      z-index: 2;
      padding: 0.375rem 0.625rem;
      white-space: nowrap;
      font-size: 0.8125rem;
      background: var(--app-surface);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      box-shadow: 0 8px 16px -4px rgba(16, 24, 40, 0.12);
      transform: translate(-50%, calc(-100% - 0.5rem));
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s ease;
    }
    .tip strong {
      color: var(--bs-emphasis-color);
    }
    .slot:hover .tip,
    .slot:focus-visible .tip {
      opacity: 1;
    }
    .x-axis {
      display: flex;
      grid-column: 2;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--app-muted);
    }
    .x-axis span {
      flex: 1;
      text-align: center;
    }
  `,
  template: `
    <div class="chart" [style.--plot-h.px]="height()">
      <div class="y-axis" aria-hidden="true">
        @for (t of ticks(); track t) {
          <span [style.bottom.%]="(t / scale().max) * 100">{{ t }}</span>
        }
      </div>
      <div class="plot">
        @for (t of ticks(); track t) {
          <div
            class="grid-line"
            [style.bottom.%]="(t / scale().max) * 100"
            aria-hidden="true"
          ></div>
        }
        <ul class="columns" [attr.aria-label]="label()">
          @for (d of data(); track d.label; let last = $last) {
            @let pct = (d.value / scale().max) * 100;
            <li
              class="slot"
              tabindex="0"
              [attr.aria-label]="d.label + ': ' + d.value + ' ' + unit()"
            >
              <div class="bar" [style.height.%]="pct"></div>
              @if (last) {
                <span class="cap" [style.bottom.%]="pct" aria-hidden="true">{{ d.value }}</span>
              }
              <span class="tip" [style.bottom.%]="pct" aria-hidden="true">
                <strong>{{ d.value }}</strong> {{ unit() }} · {{ d.label }}
              </span>
            </li>
          }
        </ul>
      </div>
      <div class="x-axis" aria-hidden="true">
        @for (d of data(); track d.label) {
          <span>{{ d.label }}</span>
        }
      </div>
    </div>
  `,
})
export class ColumnChartComponent {
  readonly data = input.required<ColumnDatum[]>();
  /** Accessible name of the chart. */
  readonly label = input.required<string>();
  /** Unit read after each value, e.g. "applications". */
  readonly unit = input('');
  readonly height = input(200);

  protected readonly scale = computed(() =>
    niceScale(Math.max(0, ...this.data().map((d) => d.value))),
  );

  protected readonly ticks = computed(() => {
    const { max, step } = this.scale();
    return Array.from({ length: max / step + 1 }, (_, i) => i * step);
  });
}
