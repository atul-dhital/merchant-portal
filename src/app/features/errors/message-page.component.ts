import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Used for /forbidden and the not-found route; text comes from route data. */
@Component({
  selector: 'app-message-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="text-center py-5">
      <h1 class="h3">{{ heading() }}</h1>
      <p class="text-body-secondary">{{ message() }}</p>
      <a class="btn btn-primary" routerLink="/applications">Back to applications</a>
    </section>
  `,
})
export class MessagePageComponent {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
}
