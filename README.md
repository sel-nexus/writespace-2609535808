# WriteSpace

A complete browser-only writing demo built with React 18, Vite 5, JavaScript JSX, React Router 6 and Tailwind 3.4. Includes public discovery, local registration/login, role-aware post reading/creation/editing/deletion, an administrator overview and protected local account management.

## Run locally

From the repository root:

```sh
cd frontend
npm ci --bin-links=false
node node_modules/vite/bin/vite.js
```

The supplied development `.env` uses `http://127.0.0.1:5173`. On a fresh checkout, copy `frontend/.env.example` to `frontend/.env`. Adjust `VITE_HOST` and `VITE_PORT` for local serving; these are tool configuration, not secrets. Any future `VITE_*` client configuration is public and baked into the static build. No runtime API configuration is required.

## Persistence contract

- `writespace_posts` and `writespace_users` store JSON arrays. Missing, malformed, non-array, or inaccessible values read as `[]`. Individual entries and stored order are preserved; reads never repair, migrate, or delete data.
- `writespace_session` stores identity strings `userId`, `username`, `displayName` and role `admin` or `user`. Invalid or inaccessible sessions read as `null`.
- Writes return `{ ok: true }` only after `setItem` completes, or `{ ok: false, reason: "serialization" | "quota" | "unavailable" }`. Session removal returns success only after `removeItem` completes; failures return `unavailable`.
- Built-in demo login is `admin` / `admin`. Registration creates ordinary writers; administrators may provision either role. Accounts and posts persist only within the current browser profile/origin. There is no seeded writing; the initial lists are empty.
- Usernames use exact string equality. Dates display English UTC. Editing preserves author and creation metadata. Removing accounts never removes/reassigns posts. The fourth `Total users` dashboard metric is explicitly undefined because its source formula is unspecified.

## Tests

```sh
cd frontend
NODE_ENV=test node node_modules/vitest/vitest.mjs run
```

Vitest discovers only `src/**/*.test.{js,jsx}` and uses one worker. `npm test` runs all source tests through the direct Node entry. Playwright uses one worker and a fixture that automatically fails on console errors and uncaught page errors. Its URL/port are selected through `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_PORT` (keep them aligned); the config starts Vite or reuses an existing server.

Browser journeys verify actual localStorage, reloads, role/ownership boundaries, cancellations, storage failures, alternate entry points and responsive layouts. Run:

```sh
cd frontend
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test
```

## Static build and delivery

```sh
cd frontend
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js preview
```

The build outputs `frontend/dist`. Container build context is `frontend`: `docker build -t writespace frontend`, then `docker run --rm -p 8080:80 writespace`. nginx serves `/` for liveness and falls back to `index.html` for nested routes. The root Vercel configuration retains compatibility build paths and the SPA rewrite; the approved deployment target is AWS static-container delivery, not an application backend.

## Important demo limitations

Data belongs to one browser profile and origin. It is not synchronized or backed up by the asset host. Clearing browser data removes it. There is no server identity, authorization, API, or database. Local credentials are plaintext and session roles can be changed by the browser user. Never enter real passwords or sensitive information; no confidentiality or secure multi-user authentication is promised. Concurrent tabs may overwrite records; there is no multi-key transaction, automatic retry, destructive repair, or cloud fallback.

## Verification and release caveats

Development verified 517 unit/component tests, all 71 browser cases (69 initially passed; the two affected specs passed all 22 cases after fixes), and the production Vite bundle. Independent test review passed after two rounds with score 1.0 and no high failures. Representative desktop/mobile accessibility trees, computed styles, HTML and screenshots were captured with `frontend/scripts/preflight.js` (Playwright's current `locator.ariaSnapshot()` API). Local static-container build/runtime checks are documented in the stage test report; AWS deployment, HTTPS, image vulnerability scanning and proposed mobile-network performance targets remain downstream verification.

Direct dependencies and transitive package-lock are committed. Compatible security updates were applied, but npm audit still reports 8 dependency advisories (5 moderate, 1 high, 2 critical; production-only: 2 moderate). Remaining fixes require leaving prescribed Vite 5 / Router 6 / Vitest 2 versions. Do not expose Vite or Vitest development/UI servers publicly; deploy only the nginx static bundle. This is an explicitly insecure local-credential demo, not a production identity service.
