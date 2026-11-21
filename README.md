# Merchant Payments Portal (Angular take-home)

A merchant-onboarding portal with three roles. **Sales** create merchant applications in a multi-step wizard that saves drafts automatically. **Admins** assign them to reviewers. **Reviewers** record risk decisions. Sensitive values (bank account and national ID numbers) are masked by default and revealed only to permitted roles, with each reveal logged.

Built with **Angular 21** (standalone, zoneless, signals), **RxJS**, **Reactive Forms**, **Bootstrap 5 + SCSS**, **Vitest + TestBed**. A small **Express mock API** provides auth with token refresh and server-side permission checks.

- [Quick start](#quick-start)
- [Requirement → implementation map](#requirement--implementation-map)
- [Architecture](#architecture)
- [Key flows](#key-flows)
- [Mock API](#mock-api)
- [Testing](#testing)
- [Accessibility and responsive design](#accessibility-and-responsive-design)
- [Trade-offs and scope](#trade-offs-and-scope)
- [AI tool usage](#ai-tool-usage)
- Security and CSP: see [SECURITY.md](SECURITY.md)

---

## Quick start

Requirements: Node.js 20.19+ (or 22.12+), npm 10+.

```bash
npm install
npm start          # mock API on :3000 + Angular dev server on :4200 (proxied, same origin)
```

Open http://localhost:4200 and choose a demo account:

| Account       | Role     | What to try                                                          |
| ------------- | -------- | -------------------------------------------------------------------- |
| Sam Sales     | SALES    | Create an application, watch auto-save, submit it                    |
| Riya Reviewer | REVIEWER | Sees only assigned applications, records approve/reject/request-info |
| Ada Admin     | ADMIN    | Sees everything, assigns a reviewer, reveals a masked field          |

There is one demo account per account type. They have no passwords, and all seed data is fictional.

Ownership and assignment isolation still holds: SALES sees only their own applications, and a REVIEWER only the ones assigned to them. The API enforces this, and unit tests prove it with test-only second users (see `application-policy.spec`).

| Script                  | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm start`             | API + web app together                          |
| `npm test`              | Unit tests (Vitest + TestBed), single run       |
| `npm run test:watch`    | Tests in watch mode                             |
| `npm run test:coverage` | Tests with coverage report                      |
| `npm run lint`          | ESLint (incl. template a11y rules) + mock API type-check |
| `npm run build`         | Production build                                |

**Demo the token refresh:** a dev-only **Expire token** button in the header invalidates every access token on the server. Then change a filter or reload the list: the dashboard loads the page and the status counts in parallel, both get 401 together, and the Network tab shows a **single** `POST /api/auth/refresh` followed by both retried calls. The *concurrent* case (several 401s at once leading to exactly one refresh) is proven by a unit test in [auth.interceptor.spec.ts](src/app/core/auth/auth.interceptor.spec.ts).

**Demo error/retry states:** copy `mock-api/.env.example` to `mock-api/.env`, set `MOCK_FAIL_RATE=0.3`, then restart. About 30% of API calls now fail with 503, which shows the dashboard's error and Retry state and the auto-save error handling.

---

## Requirement → implementation map

| PDF requirement | Where |
| --- | --- |
| Angular 20+, standalone, `@if`/`@for` | Angular 21; no NgModules; built-in control flow only (`@if`, `@for`, `@switch`, `@let`) |
| Signals, `inject()`, RxJS | Signal state everywhere ([auth.store.ts](src/app/core/auth/auth.store.ts)); `inject()` only; RxJS for HTTP, search, auto-save, refresh |
| Reactive Forms, custom validation, draft saving | [application-form.ts](src/app/features/applications/wizard/application-form.ts), [application.validators.ts](src/app/features/applications/wizard/application.validators.ts), [draft-autosave.service.ts](src/app/features/applications/wizard/draft-autosave.service.ts) |
| Bootstrap 5 + SCSS, responsive | [styles.scss](src/styles.scss) + [src/styles/](src/styles/) (tokens, theme, layout, components; selective Bootstrap import); collapsible sidebar / mobile drawer; table → cards on small screens |
| Router: lazy features + guards | [app.routes.ts](src/app/app.routes.ts), [applications.routes.ts](src/app/features/applications/applications.routes.ts), [auth.guards.ts](src/app/core/auth/auth.guards.ts), [unsaved-changes.guard.ts](src/app/features/applications/wizard/unsaved-changes.guard.ts) |
| Interceptor: bearer + refresh **once** for concurrent 401s; `POST /auth/refresh` mock | [auth.interceptor.ts](src/app/core/auth/auth.interceptor.ts), [auth.service.ts](src/app/core/auth/auth.service.ts) `refreshAccessToken()`, [mock-api/src/auth.ts](mock-api/src/auth.ts) |
| Vitest + TestBed | `ng test` (Angular's Vitest runner); 20 spec files, 135 tests |
| Roles SALES / REVIEWER / ADMIN | UI: [auth.models.ts](src/app/core/auth/auth.models.ts) + [application-policy.ts](src/app/features/applications/data-access/application-policy.ts). API: [mock-api/src/policy.ts](mock-api/src/policy.ts) |
| **A.** Dashboard: server-side pagination, filtering, loading/error/retry, permission-aware navigation | [dashboard/](src/app/features/applications/dashboard/) |
| **B.** Multi-step wizard, field-level validation, drafts | [wizard/](src/app/features/applications/wizard/) |
| **C.** Auto-save: RxJS debounce, error handling, form state never lost | [draft-autosave.service.ts](src/app/features/applications/wizard/draft-autosave.service.ts) |
| **D.** Detail: sections, risk history, review controls hidden from SALES | [detail/](src/app/features/applications/detail/) |
| **F.** Sensitive fields masked, role-based reveal; CSP explained | [masked-value.component.ts](src/app/features/applications/detail/masked-value.component.ts), [SECURITY.md](SECURITY.md) |
| Optional: dashboard counts by status | Built once the core was complete: status filter chips with live counts (`GET /api/applications/counts`) |
| Optional: Socket.IO real-time updates | Built: [realtime.service.ts](src/app/core/realtime/realtime.service.ts) (client), [mock-api/src/realtime.ts](mock-api/src/realtime.ts) (server). See [Real-time updates](#real-time-updates-socketio) |

---

## Architecture

```
mock-api/src/            Express mock backend (auth, policy, seed, routes)
src/app/
├─ core/
│  ├─ auth/              AuthStore (signals), AuthService, interceptor, guards, role→permission map
│  ├─ http/              errorMessage(): safe, user-facing error text
│  ├─ realtime/          RealtimeService: Socket.IO status updates, live indicator data
│  └─ layout/            Shell (sidebar, top bar with search and account menu)
├─ shared/
│  ├─ forms/             ControlStateDirective (is-invalid + aria-invalid), FieldErrorsComponent
│  ├─ ui/                ErrorAlert (with Retry), Pagination
│  └─ validators/        Generic date validators
└─ features/
   ├─ auth/              Login (demo account picker, split layout)
   ├─ overview/          Overview page: KPI tiles, monthly chart, status meters, attention list, activity
   ├─ errors/            Forbidden / not-found page
   └─ applications/
      ├─ data-access/    Models, ApplicationsApi, applicationActions() policy
      ├─ ui/             StatusBadge, mask()
      ├─ dashboard/      List with URL-driven filters + pagination
      ├─ wizard/         Form factory, validators, steps, auto-save, unsaved-changes guard
      └─ detail/         Sections, risk history, review panel, assignment panel, masked value
```

**State.** Signal-based services and component signals; no NgRx. The app is small, and the rubric asks for both signals and RxJS, so each is used where it fits: **RxJS for async flows** (HTTP, debounce, retry, cancellation, sequencing) and **signals for state the template reads**. They are bridged with `toSignal`, `toObservable` and `linkedSignal`.

**Zoneless.** The app runs without zone.js (Angular 21 default). Components are `OnPush` unless they render Reactive Forms state, which is not signal-based. The wizard re-renders on `form.events`, so async validator results also show up.

**Routing.** Every feature is lazy (`loadComponent` / `loadChildren`):

| Route | Protection |
| --- | --- |
| `/login` | `guestGuard` |
| `/dashboard` (landing page) | inside the authenticated shell |
| Shell and all children | `canMatch: authGuard` (redirects with a safe `returnUrl`) |
| `applications/new` | `permissionGuard('application:create')`, `unsavedChangesGuard` |
| `applications/:id/edit` | `permissionGuard('application:edit')`, `unsavedChangesGuard`, draft resolver (API 403/404 → redirect) |

Route params and query params arrive as signal `input()`s through `withComponentInputBinding()`.

**Permissions.** Roles map to permission strings ([auth.models.ts](src/app/core/auth/auth.models.ts)). Per-application rules (owner, assigned reviewer, status) live in `applicationActions()`. Templates only ask questions like `actions().canDecide`. The API enforces the same rules on its own, so hiding a button is never the only protection.

---

## Key flows

### Single-flight token refresh ([auth.interceptor.ts](src/app/core/auth/auth.interceptor.ts))
1. The bearer token is attached to `/api/*` only. It is never sent to `/api/auth/*` or to other origins.
2. On a 401, the interceptor calls `AuthService.refreshAccessToken()`. That method keeps **one shared in-flight observable** (`shareReplay`): the first 401 starts `POST /api/auth/refresh`, and every other 401 that arrives meanwhile joins the same call.
3. Each failed request is retried **once** with the new token. An `HttpContextToken` flag prevents retry loops.
4. If a 401 arrives *after* a refresh already finished (a slow request), the interceptor sees the token has changed and retries without refreshing again.
5. If the refresh fails, the session ends once and the user is sent to `/login`.

This avoids redundant refresh calls and token churn: the server **rotates** the refresh token on every use. Cases a single tab can't coordinate (two tabs refreshing at once, or a reload that aborts a refresh response) are covered on the server by a 10-second reuse grace window for the just-rotated token.

### Auto-save ([draft-autosave.service.ts](src/app/features/applications/wizard/draft-autosave.service.ts))
```
merge(valueChanges.debounceTime(1500), saveNow$)
  → concatMap(() => defer(saveLatest))       // strictly sequential; reads the LATEST value when it runs
       → skip if unchanged since last save
       → POST (first time, creates the draft) or PUT
       → retry 5xx/network with backoff (1s, 2s); 4xx not retried
       → catchError → status "error" (stream stays alive)
```
- `concatMap` guarantees the draft-creating POST finishes before any PUT, so no duplicate drafts.
- The service **never writes to the form**: a failed save cannot lose input. Status (`saving` / `saved hh:mm` / `error` + "Retry now") is announced in an `aria-live` region.
- Saves also run on step change and on "Save draft". After the first save, the URL becomes `/applications/:id/edit` (via `Location.replaceState`, without re-creating the component), so a reload reopens the draft.
- `submit()` waits for any in-flight save, then pauses auto-save so no PUT can follow submission.
- Leaving the page with unsaved changes prompts (`canDeactivate` plus `beforeunload`).

### Look and feel
- An admin-dashboard layout in the style of the TailAdmin SaaS template, rebuilt in Bootstrap 5 + SCSS (the brief requires Bootstrap; no Tailwind and no template code), with TechKraft branding.
- **Shell:** a collapsible sidebar (an icon rail on desktop, a drawer on mobile), and a sticky top bar with application search (`Ctrl/⌘ K`) and an account menu.
- **Overview** (`/dashboard`, the landing page), all scoped by role through `GET /api/overview`:
  - KPI tiles;
  - "New applications" per month: a column chart with hover/focus tooltips and a Chart / Table toggle;
  - "By status" meters, each linking to the filtered list;
  - a role-specific "needs attention" list;
  - recent activity.
- **Charts** are plain HTML/CSS: no chart library, so the CSP is unaffected. They use a single hue validated for contrast on both card surfaces, hairline gridlines, rounded data-ends, and a value label on the latest column only.
- **Light theme only.** Bootstrap's dark color mode is switched off (`$enable-dark-mode: false`), so no dark CSS ships.
- **Typography:** a single family everywhere, the Outfit variable font, self-hosted from `node_modules` (OFL licence) so `font-src 'self'` still holds.
  - Even the monospace stack points to Outfit: masked numbers use tabular figures instead of a code font.
  - One type scale: 12 / 13 / 15 / 18 / 24 / 30 px.
  - Three weights: 400 text, 500 labels and buttons, 600 headings.
- **Sign-in:** three account-type cards (Sales, Reviewer, Admin) in one row, stacked on phones. Each card says what that role can do and has one "Sign in as …" button for that type's demo account. The role descriptions live in one place (`ROLE_INFO` in [auth.models.ts](src/app/core/auth/auth.models.ts)) and are shared with the sidebar.

### Interactive feedback
- **Toasts** ([toast.service.ts](src/app/shared/ui/toast.service.ts)) confirm actions: submission, decision, assignment, sign-out, session expiry. They live in one polite `aria-live` region and auto-dismiss.
- **Confirm dialogs** ([confirm.service.ts](src/app/shared/ui/confirm.service.ts)) use the native `<dialog>`, which provides focus trapping, Esc to cancel and focus starting on Cancel. They guard submitting an application, recording a decision (red for Reject) and leaving the wizard with unsaved changes. `await confirm.ask({...})` resolves true or false.
- **Dashboard:** status filter chips with live counts (toggle buttons with `aria-pressed`), skeleton rows while loading, and `/` to jump to search.
- **Wizard:** completion progress bar, checkmarks on completed steps, fade-in step transitions.
- **Review panel:** decision and risk level are radio inputs styled as buttons, so keyboard and screen-reader behaviour stays native.
- **Revealed values** are highlighted, with a bar counting down to automatic re-masking.
- All motion is plain CSS (CSP-safe) and switched off under `prefers-reduced-motion`.

### Real-time updates (Socket.IO)
When someone changes an application, everyone allowed to see it gets the change instantly. Changes are creation, submission, reviewer assignment and decisions.

| Piece | Behaviour |
| --- | --- |
| Server ([mock-api/src/realtime.ts](mock-api/src/realtime.ts)) | Socket.IO on the API's port (`/socket.io`, WebSocket only). The handshake must carry a valid **access token**; there is no cookie auth, so cross-site WebSocket hijacking isn't possible. Each update goes **only** to sockets whose user passes the same `policy.canView` rule as the REST API. The payload is the list summary only, with no sensitive fields. Sockets with an expired token are disconnected. |
| Client ([realtime.service.ts](src/app/core/realtime/realtime.service.ts)) | Connects while signed in and disconnects on sign-out. The Socket.IO client is **lazy-loaded** (its own ~43 kB chunk, not in the initial bundle). The token is read fresh on every (re)connect. If the server rejects or drops the socket for an expired token, the client renews it through `AuthService.refreshAccessToken()`, the same single shared refresh the HTTP interceptor uses, and reconnects. |
| UI | A **Live** indicator in the top bar. The dashboard list and status counts, the Overview and an open detail page refresh themselves (bursts are debounced). Changes made by **other** users raise a toast, e.g. "MA-2026-0032 approved by Riya Reviewer". |

**Try it:** open two browser windows, one signed in as Sam Sales on *Applications* and one as Riya Reviewer. When Riya records a decision, Sam's list and counts update and a toast appears, with no reload.

### Dashboard ([dashboard.component.ts](src/app/features/applications/dashboard/dashboard.component.ts))
The URL query string (`page`, `pageSize`, `status`, `q`) is the single source of truth, so views are shareable and work with back/forward. Search is debounced (300 ms). `switchMap` cancels stale requests. The last page stays on screen while the next one loads.

### Wizard validation
- **Field validators:** required, length, pattern (E.164 phone, registration number, account number, SWIFT), email, URL, not-in-future date, minimum age 18.
- **Cross-field:** postal code format per country; total ownership ≤ 100% across a `FormArray`; average ticket ≤ monthly volume.
- **Async:** registration number uniqueness, debounced. Network errors don't block the user, because the server re-checks on submit.
- **Step gating:** "Next" marks the step touched, shows an error summary and focuses the first invalid field. It waits for pending async validation first. Later steps can't be reached until earlier ones are valid.

### Sensitive data
The API sends sensitive values already masked (`•••• 1234`). Revealing one calls `POST /applications/:id/reveal`. The server checks permission (ADMIN, or the assigned REVIEWER) and adds a `SENSITIVE_REVEALED` event to the history. The revealed value lives only in that component's memory and is hidden again after 30 seconds. Details are in [SECURITY.md](SECURITY.md).

---

## Mock API

`mock-api/src/server.ts` is an in-memory Express server with fictional seed data. Every change is lost on restart. It is proxied at `/api` by the Angular dev server ([proxy.conf.json](proxy.conf.json)), so the app and the API share an origin and the refresh cookie works without CORS.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/auth/demo-users` | public |
| POST | `/api/auth/login` · `/api/auth/refresh` · `/api/auth/logout` | public (refresh uses the httpOnly cookie) |
| GET | `/api/applications?page&pageSize&status&q` | scoped: SALES own, REVIEWER assigned, ADMIN all |
| GET | `/api/applications/counts?q` | counts per status, same scoping |
| GET | `/api/overview` | overview data (counts, monthly intake, attention list, activity), same scoping |
| WS | `/socket.io` → event `application:updated` | real-time status updates; access token in the handshake; only to users who may see the application |
| POST | `/api/applications` | SALES (creates a draft) |
| GET | `/api/applications/:id` | anyone who can view it (sensitive fields masked) |
| GET / PUT | `/api/applications/:id/draft` | author, while DRAFT / INFO_REQUESTED |
| POST | `/api/applications/:id/submit` | author; validated on the server |
| PUT | `/api/applications/:id/assignment` | ADMIN |
| POST | `/api/applications/:id/decision` | assigned REVIEWER, while IN_REVIEW |
| POST | `/api/applications/:id/reveal` | ADMIN or assigned REVIEWER; audited |
| GET | `/api/users?role=REVIEWER` | ADMIN |
| GET | `/api/validation/registration-number` | authenticated |
| POST | `/api/dev/expire-tokens` | dev only (disabled when `NODE_ENV=production`) |

Applications a user may not see return **404, not 403**, so their existence isn't leaked. Status flow: `DRAFT → SUBMITTED → IN_REVIEW (assigned) → APPROVED | REJECTED | INFO_REQUESTED → (sales edits) → resubmitted`.

Configuration (`mock-api/.env`, optional; see `.env.example`): `ACCESS_TOKEN_TTL_SECONDS` (default 60), `MOCK_LATENCY_MS` (300), `MOCK_FAIL_RATE` (0), `MOCK_PORT` (3000).

---

## Testing

`npm test` runs **135 tests in 20 spec files** with Vitest + Angular TestBed (`npm run test:coverage` for a coverage report).

| Spec | What it proves |
| --- | --- |
| `auth.interceptor.spec` | Bearer attached only to our API; **3 concurrent 401s → exactly 1 refresh → 3 retries with the new token**; late 401 retried without a second refresh; no retry loop; failed refresh → single logout; non-401 errors pass through |
| `auth.service.spec` | Login stores session in memory; session restore from cookie; "no session" is not an error; logout always clears |
| `login.component.spec` | Demo accounts listed; returns to requested page; rejects external returnUrl; error re-enables buttons |
| `auth.guards.spec` | authGuard returnUrl, guestGuard, permissionGuard per role, open-redirect protection |
| `application-policy.spec` | Ownership, assignment and status rules per role |
| `application.validators.spec` | Ownership total, ticket vs volume, postal code per country, dates, debounced async uniqueness |
| `draft-autosave.service.spec` | Debounce, POST-then-PUT ordering, skip unchanged, error keeps value and stream recovers, backoff on 5xx only, submit waits for in-flight save |
| `dashboard.component.spec` | URL → server query params and filter controls, skeleton → rows, error → Retry, out-of-range page recovery, status chips with counts (follow search, not refetched on status change), `/` shortcut, role-specific actions |
| `application-wizard.component.spec` | Next blocked with aria-invalid + messages, advances when valid, no skipping ahead, `FormArray` total, existing draft loads clean (not saved back, steps enabled after async check), progress bar, submit only after confirmation (and not on cancel), unsaved-changes guard via dialog |
| `owners-step.component.spec` | Add/remove owners up to the limit; national ID hidden until shown |
| `application-detail.component.spec` | SALES: no review/assign/reveal, data masked; assigned vs unassigned reviewer; ADMIN assign only |
| `review-panel.component.spec` | Conditional notes requirement; API called only when valid and confirmed; cancel records nothing; success toast |
| `masked-value.component.spec` | Masked by default, no reveal without permission, re-masks after 30 s and when reused for another application |
| `shell.component.spec` | Sidebar items per role, current-section highlighting, header search, `Ctrl+K`, account menu (Escape returns focus, sign out) |
| `overview.component.spec` | KPI maths from scoped counts, role-specific attention wording and actions, activity sentences, chart ↔ table toggle, error + retry |
| `charts.spec` | Column chart: focusable labelled columns, round axis, latest-value label; status meters: workflow order, shares, filter links |
| `format.spec` | Relative time, nice axis scale, initials |
| `realtime.service.spec` | Connects only when signed in, sends the current token, goes live, forwards updates; renews an expired token via the shared refresh and reconnects; ignores network blips; disconnects on sign-out; toast wording |
| Live updates in `dashboard` / `overview` / `application-detail` / `shell` specs | List and counts reload, overview refreshes, detail reloads for others' changes only, toast only for other users' changes, Live indicator |
| `feedback.spec` | Toasts auto-dismiss, max three, dismiss button; confirm resolves true/false, one at a time, accessible dialog, Esc cancels |
| `panels.spec` | Assignment: current reviewer not offered, assign emits; risk history: decisions, risk level, notes and audited reveals, newest first |

> **Windows note:** if `npm test` reports *"Vitest failed to find the runner"*, your shell's drive letter is lowercase (`d:\…`). Run it from a path with an uppercase drive letter (`D:\…`); this is a known Vitest-on-Windows path issue.

Besides unit tests, every role flow was walked through in a real browser (headless Chromium). That walkthrough covered: login redirect, filters synced to the URL, wizard validation (sync, async, cross-field), auto-save creating the draft, submit, admin assignment and reveal (with the audit event), reviewer decision, reviewer blocked from `/applications/new`, and the mobile layout. The production build was also served with the CSP from [SECURITY.md](SECURITY.md) and scanned with axe-core (WCAG 2.1 A/AA) on every screen for every role, including mobile: no CSP violations, no console errors, no axe violations.

---

## Accessibility and responsive design

- Semantic landmarks, a skip link, and one `h1` per page. Every input has a `<label>`; hints and errors are linked with `aria-describedby`.
- `aria-invalid` and Bootstrap's `is-invalid` are applied together by one directive. An error summary appears on a blocked step and focus moves to the first invalid field.
- Focus moves to the step heading on step change. Save status, list loading and result counts, and reveals are announced through `aria-live`.
- The stepper uses `aria-current="step"` and pagination uses `aria-current="page"`. Tables have captions and `scope="col"`. Icon-only context is given visually hidden text (for example, "Review MA-2026-0003").
- Visible `:focus-visible` outline, and `prefers-reduced-motion` is respected.
- `angular-eslint` template accessibility rules run in `npm run lint`.
- Layout: the sidebar becomes a drawer below `lg` (Esc or the backdrop closes it); the dashboard table becomes stacked cards below `md`; forms collapse to one column.
- axe-core (WCAG 2.1 A/AA) reports no violations on any screen.
- Colour choices are computed, not eyeballed: semantic colours used as text are at least 4.5:1 on their backgrounds.

---

## Trade-offs and scope

- **Mock auth.** Demo account picker with no passwords, so no credential-like data exists in the repo. Production would use an identity provider (OIDC).
- **In-memory API.** Restarting resets the data. Concurrent edits of the same draft use last-write-wins; a production API would use versioning.
- **Draft data is server-side only.** Nothing is written to `localStorage` or `sessionStorage`, so no PII persists in the browser. The trade-off: if the network is down, unsaved edits survive only while the tab stays open. The UI says so and offers retry.
- **Sales sees full values in their own editable draft** (they are the person entering the data). Once submitted, Sales sees only masked values.
- **Optional enhancements:** both were added after the core was complete: status counts and Socket.IO real-time updates.

---

## AI tool usage

I used an AI coding assistant (Claude Code) for a large part of the implementation, tests and documentation. I made the technical decisions, reviewed the code, and take full responsibility for it.

Verification:

- `npm run lint`, `npm test` (135 tests) and `npm run build` (within the size budget) all pass;
- a scripted browser walkthrough of every role against the mock API;
- the production build served under the CSP from SECURITY.md, plus an axe-core WCAG 2.1 AA scan, both with no violations;
- direct API requests confirming the server enforces permissions and masks sensitive fields.
