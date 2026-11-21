import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: string;
}

/** Page title with breadcrumb; projected content becomes the page actions. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-header' },
  template: `
    <div>
      <h1>{{ heading() }}</h1>
      @if (subtitle(); as sub) {
        <p class="text-body-secondary mb-0 mt-1">{{ sub }}</p>
      }
      @if (crumbs().length) {
        <nav aria-label="Breadcrumb" class="mt-1">
          <ol class="breadcrumb">
            @for (c of crumbs(); track c.label; let last = $last) {
              @if (last || !c.link) {
                <li class="breadcrumb-item active" [attr.aria-current]="last ? 'page' : null">
                  {{ c.label }}
                </li>
              } @else {
                <li class="breadcrumb-item">
                  <a [routerLink]="c.link">{{ c.label }}</a>
                </li>
              }
            }
          </ol>
        </nav>
      }
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <ng-content />
    </div>
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  readonly crumbs = input<Crumb[]>([]);
}
