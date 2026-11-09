# WriteSpace

A static React 18 / Vite 5 / JavaScript / React Router 6 / Tailwind 3.4 frontend. This slice provides defensive browser persistence and a complete read-only local welcome. It does not implement account flows, publishing, or administrator features.

## Run locally

From the repository root:

```sh
cd frontend
npm install --no-package-lock --bin-links=false
node node_modules/vite/bin/vite.js
```

The supplied development `.env` uses `http://127.0.0.1:5173`. On a fresh checkout, copy `frontend/.env.example` to `frontend/.env`. Adjust `VITE_HOST` and `VITE_PORT` for local serving; these are tool configuration, not secrets. Any future `VITE_*` client configuration is public and baked into the static build. No runtime API configuration is required.

## Persistence contract

- `writespace_posts` and `writespace_users` store JSON arrays. Missing, malformed, non-array, or inaccessible values read as `[]`. Individual entries and stored order are preserved; reads never repair, migrate, or delete data.
- `writespace_session` stores identity strings `userId`, `username`, `displayName` and role `admin` or `user`. Invalid or inaccessible sessions read as `null`.
- Writes return `{ ok: true }` only after `setItem` completes, or `{ ok: false, reason: "serialization" | "quota" | "unavailable" }`. Session removal returns success only after `removeItem` completes; failures return `unavailable`.
- The welcome reads these helpers and offers a read-only refresh summary. It never seeds or clears records.

## Tests

```sh
cd frontend
node node_modules/vitest/vitest.mjs run src/utils/storage.test.js src/utils/auth.test.js
```

Vitest discovers only `src/**/*.test.{js,jsx}` and uses one worker. `npm test` runs all source tests through the direct Node entry. Playwright uses one worker and a fixture that automatically fails on console errors and uncaught page errors. Its URL/port are selected through `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_PORT` (keep them aligned); the config starts Vite or reuses an existing server.

Browser execution is deferred to the parent verification stage. When authorized there:

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

Direct dependencies are pinned. This scoped slice intentionally does not generate a lockfile; reproducible transitive locking and dependency/image scanning remain release-stage responsibilities. Production build, container runtime, browser journeys, accessibility preflight, and deployment verification are not claimed by this implementation slice.
