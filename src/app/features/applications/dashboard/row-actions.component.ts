import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationActions } from '../data-access/application-policy';
import { ApplicationSummary } from '../data-access/application.models';

/** Permission-aware row actions: only what this user may do on this application. */
@Component({
  selector: 'app-row-actions',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-inline-flex flex-wrap gap-1' },
  template: `
    @let app = item();
    @if (actions().canEdit) {
      <a class="btn btn-sm btn-outline-primary" [routerLink]="['/applications', app.id, 'edit']">
        Continue editing<span class="visually-hidden"> {{ app.reference }}</span>
      </a>
    }
    @if (actions().canDecide) {
      <a class="btn btn-sm btn-primary" [routerLink]="['/applications', app.id]" fragment="review">
        Review<span class="visually-hidden"> {{ app.reference }}</span>
      </a>
    }
    @if (actions().canAssign) {
      <a
        class="btn btn-sm btn-outline-primary"
        [routerLink]="['/applications', app.id]"
        fragment="assignment"
      >
        Assign<span class="visually-hidden"> {{ app.reference }}</span>
      </a>
    }
    <a class="btn btn-sm btn-outline-secondary" [routerLink]="['/applications', app.id]">
      View<span class="visually-hidden"> {{ app.reference }}</span>
    </a>
  `,
})
export class RowActionsComponent {
  readonly item = input.required<ApplicationSummary>();
  readonly actions = input.required<ApplicationActions>();
}
