import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav aria-label="Pagination">
        <ul class="pagination pagination-sm mb-0 flex-wrap">
          <li class="page-item" [class.disabled]="page() <= 1">
            <button
              type="button"
              class="page-link"
              [disabled]="page() <= 1"
              (click)="go(page() - 1)"
            >
              Previous
            </button>
          </li>
          @for (p of pages(); track p) {
            <li class="page-item" [class.active]="p === page()">
              <button
                type="button"
                class="page-link"
                [attr.aria-current]="p === page() ? 'page' : null"
                [attr.aria-label]="'Page ' + p"
                (click)="go(p)"
              >
                {{ p }}
              </button>
            </li>
          }
          <li class="page-item" [class.disabled]="page() >= totalPages()">
            <button
              type="button"
              class="page-link"
              [disabled]="page() >= totalPages()"
              (click)="go(page() + 1)"
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  /** A window of at most 5 page numbers around the current page. */
  readonly pages = computed(() => {
    const last = this.totalPages();
    const start = Math.max(1, Math.min(this.page() - 2, last - 4));
    const end = Math.min(last, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  go(p: number): void {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) this.pageChange.emit(p);
  }
}
