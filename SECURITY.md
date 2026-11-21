# Security notes

This app handles merchant onboarding data, including bank account numbers and owners' national IDs. The controls below are layered, so no single mistake exposes data.

## 1. Authorization: enforced on the server, mirrored in the UI

| Layer | What it does | Where |
| --- | --- | --- |
| API policy | Every route checks role **and** ownership/assignment **and** status. Hidden records return 404. | [mock-api/src/policy.ts](mock-api/src/policy.ts), [mock-api/src/server.ts](mock-api/src/server.ts) |
| Route guards | Block navigation to pages the role can't use (`/applications/new` for non-Sales, and so on) | [auth.guards.ts](src/app/core/auth/auth.guards.ts) |
| Permission-aware UI | Review, assignment and reveal controls are **not rendered** (`@if`), not just disabled | [application-policy.ts](src/app/features/applications/data-access/application-policy.ts) |

Rules: SALES see and edit only their own applications, and edit only while DRAFT / INFO_REQUESTED. REVIEWERs see and decide only applications assigned to them. ADMINs see all and assign, but do not record decisions. The UI is a convenience; the API is the authority. For example, a SALES user calling `POST /api/applications/:id/decision` directly gets 404/403.

## 2. Tokens and session

- **Access token:** short-lived (60 s by default), held **only in memory** (an `AuthStore` signal). It is never stored in `localStorage` or `sessionStorage`, where an XSS payload could read it.
- **Refresh token:** an **httpOnly, `SameSite=Strict`, path-scoped (`/api/auth`) cookie**, `Secure` in production. JavaScript cannot read it, and it is not sent cross-site.
- **Rotation:** each refresh issues a new refresh token. The used one stays valid for a 10-second grace window, then it is revoked. Within a tab, the interceptor makes concurrent 401s share one refresh. The grace window covers what a tab can't coordinate (two tabs refreshing together, or a reload that drops the response carrying the new cookie), which would otherwise log the user out. A token used after the window is rejected.
- **Session restore:** on start-up the app silently calls `/api/auth/refresh`. A reload keeps you signed in without the access token ever being persisted.
- **Token scope:** the bearer header is attached only to same-origin `/api/*` requests, never to third-party URLs.
- **Open redirects:** `returnUrl` after login must be a path on this site (`/…`, not `//…` and not an absolute URL).
- **No secrets in the repo:** tokens are random values generated at runtime; there is no signing key to leak. `.env` files are git-ignored; only `.env.example` is committed. Demo accounts have no passwords.

- **Real-time channel (Socket.IO):**
  - Authenticated by the access token in the handshake, not a cookie, so another site can't open a socket as the user (no cross-site WebSocket hijacking).
  - Updates are filtered per socket by the same `policy.canView` rule as the REST API.
  - Payloads contain only the list summary, never sensitive fields.
  - A socket whose token expires is disconnected and must reconnect with a fresh token.

## 3. Sensitive fields (requirement F)

- The API **masks on the server** (`•••• 1234`), so full values never appear in list or detail responses, browser caches or devtools by default.
- **Controlled reveal:** `POST /api/applications/:id/reveal { field }`. It is allowed only for ADMIN and the *assigned* REVIEWER, re-checked on the server. Each reveal writes a `SENSITIVE_REVEALED` audit event, visible in the risk history.
- **Short exposure:** the clear value lives only in that `MaskedValueComponent`'s memory and is hidden again after 30 s, on "Hide", or when the component is destroyed. It is never put in global state, the URL, logs or storage.
- **Data entry:** sensitive inputs in the wizard are `type="password"` with an explicit Show/Hide toggle and `autocomplete="off"`. The review step shows them masked.
- **No client-side persistence:** drafts are saved to the API only, never to web storage. The app writes nothing to web storage. API responses carry `Cache-Control: no-store`.
- **Fictional data only:** the seed data contains no real people, businesses, cards, accounts or IDs.

## 4. Content Security Policy

CSP is the second line of defence against XSS. Even if an attacker managed to inject markup, the browser would refuse to run scripts that the policy does not allow. Recommended production response header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
  trusted-types angular angular#bundler
```

| Directive | Why |
| --- | --- |
| `script-src 'self'` | Only our own bundled JS runs. Inline scripts, `eval` and third-party scripts are blocked, which stops most injected-script XSS. |
| `require-trusted-types-for 'script'` + `trusted-types angular angular#bundler` | DOM injection sinks (`innerHTML` and similar) accept only values from Angular's sanitising Trusted Types policies, so even our own code can't write raw HTML by mistake. |
| `connect-src 'self'` | XHR/fetch and the WebSocket can only reach our own origin (CSP Level 3 browsers treat `'self'` as covering same-origin `ws:`/`wss:`). Stolen data cannot be sent to an attacker's server this way. |
| `frame-ancestors 'none'` | The app can't be framed (clickjacking). This only works as a **header**, not in a `<meta>` tag. |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | Block plugins, `<base>` hijacking, and forms posting to other sites. |
| `img-src 'self' data:` | Bootstrap renders its form icons as `data:` SVGs. |
| `font-src 'self'` | The Outfit font is self-hosted from the build (no Google Fonts request). Icons are inline SVG, not an icon font or CDN. |
| `style-src 'unsafe-inline'` | Angular injects component styles as `<style>` tags. Inline *styles* are a much smaller risk than inline scripts. To remove `'unsafe-inline'`, the server must issue a per-request nonce and pass it to Angular (`ngCspNonce` attribute or the `CSP_NONCE` token). |

**Verified:** the production build (`npm run build`) was served with exactly this header, and the Admin, Sales and Reviewer flows (login, dashboard, wizard with auto-save, detail with a reveal, and the live Socket.IO connection) ran with zero CSP violations. Two build settings make that possible:
- `optimization.styles.inlineCritical: false` in [angular.json](angular.json). Critical-CSS inlining adds an inline `onload=` handler, which `script-src 'self'` blocks.
- No inline scripts in `index.html`. Angular's `autoCsp` (a hash-based `<meta>` CSP) is the alternative for hosts that can't set headers. It is not combined with the header above, because both policies would apply and the header would block autoCsp's inline loader.

The CSP is a header, so it belongs to the hosting layer (CDN, nginx, ingress) and is not set in the Angular dev server. Vite's dev tooling injects scripts that a strict policy would block. Other recommended headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. The mock API already sends the last two, plus `Cache-Control: no-store`.

## 5. XSS hygiene in code

- Angular templates escape all interpolated values. The code has no `innerHTML` bindings, no `bypassSecurityTrust*`, and no direct DOM writes of user data.
- Server error messages are displayed as text (`errorMessage()`), never as HTML.
- Production dependencies: `npm audit --omit=dev` reports 0 vulnerabilities.
