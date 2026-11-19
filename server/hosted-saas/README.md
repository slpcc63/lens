# Lens / existing Doxle account integration candidate

Status: locally implemented and tested; NOT installed in hosted-saas or deployed. No live credentials, data transfers or production migration performed. Public release remains pending owner approval.

## Verified existing identity

Read `slpcc63/cadence` and `slpcc63/sentinel`: `lib/auth.ts` uses Better Auth and their existing database; `packages/shared-identity/index.ts` identifies the user by stable auth/customer IDs. Both were extracted from `slpcc63/hosted-saas`. The canonical local hosted-saas checkout points to https://github.com/slpcc63/hosted-saas and is on integration/v1. Its PLAN/ARCHITECTURE/PROGRESS were read. Its shared identity extraction is not yet completed; do not claim a published identity SDK exists.

Public read-only check November 19, 2026: https://app.slpcc63.com/sign-in returns HTTP 200; /api/lens returns 404. Reuse of account identity is feasible through the existing session validation. Live sign-in and provider compatibility remain unverified for Lens.

## Implementation

This folder is a reviewable integration candidate, not a new server or repository. Integrate `app/api/lens/*` into the existing hosted-saas application on an isolated branch from integration/v1, preserving its guardrails and required review. Exclude `sync.test.mjs` from deployed route folders if the hosting build requires it (it is a separate Node test, not a route).

- GET `/api/lens` presents the account portal after existing Better Auth sign-in. Unauthenticated JSON requests receive 401; UI requests redirect to the existing sign-in page with next=/api/lens.
- GET `?format=json` returns only the signed-in user's Lens settings.
- PUT requires a same-origin JSON request, existing session, matching stable account ID, valid strict schema, and expected server revision. Stale writes return 409, not last-write-wins. Account switching between review and upload also returns 409.
- Product data uses a separately configured `LENS_DATABASE_URL`; it NEVER falls back to the shared auth database or a Cadence/Sentinel database. Remote DB connections require certificate-verifying TLS.
- Migration `001_lens_settings.sql` belongs only in that Lens product database. It has not run in production. No runtime table creation.
- The native account portal uses a separate persistent WebKit data store for the first-party account session; no session-cookie extraction or custom bearer credential system. Its bridge accepts only main-frame messages from the exact HTTPS account route. Upload rechecks the page origin/path both natively and in JavaScript. No visited website can use this bridge.
- Only saved site IDs, names, HTTPS starting URLs and preferred-username reminders sync. No website credentials, cookies, browsing history or profile content. URL tokens/fragments are rejected.
- First iteration is explicit manual upload/download. Downloads require replacement confirmation and keep a protected local backup. Concurrent local edits invalidate a pending download. Later automatic merging/continuous sync is not implemented.

Existing central email/password sign-in can be reused without introducing another password vault. Google sign-in inside embedded WebKit is NOT acceptance-tested and may require a system-browser/native handoff. Do not claim Google works, alter auth/session settings or deploy custom authentication to work around it without the central project's required review.

## Enable only after reviewed deployment

1. Review/integrate in the canonical hosted-saas repository; obey its auth/database/production gates. Do not modify the active refactoring checkout or deploy an unreviewed candidate.
2. Provision/authorize the separate Lens data store, apply the migration with rollback/backups, configure the non-client `LENS_DATABASE_URL`. No auth/customer data duplication or email-based identity linking.
3. Deploy to a controlled authenticated test destination. The current native host allowlist is app.slpcc63.com only; support for a reviewed stable QA host requires a deliberate matching build configuration, not an arbitrary endpoint preference.
4. Verify real account sign-in, sign-out/account switching, denied cross-user requests, provider login behavior, backups/conflicts and real two-device transfer.
5. Set native Info.plist `LensAccountSyncURL` to `https://app.slpcc63.com/api/lens` only after the reviewed integration is ready at that destination. It is deliberately absent now; the app honestly says sync is not available yet. This is a deployment gate, not a functioning live-sync claim.

No new iOS runtime dependencies. Server uses hosted-saas's existing pg, Better Auth and Next.js dependencies; no new auth/billing subscription or emails added.

## Verification

`node --test app/api/lens/sync.test.mjs` — five passing validation/storage/portal tests.

`verification/postgres-and-routes.mjs` requires the existing hosted-saas dependency installation and a disposable loopback database named lens_sync_test. It refuses remote targets, requires explicit synthetic-test confirmation, uses a unique schema and removes only that schema. Set LENS_SYNC_TEST_DATABASE_URL, LENS_SYNC_TEST_CONFIRM=synthetic-lens-only, and LENS_HOSTED_SAAS_ROOT. It tests actual PostgreSQL CAS concurrency/owner isolation and actual route handlers with synthetic authentication. It is NOT proof of live authentication.

November 19 output:

```
PASS PostgreSQL: migration, owner isolation, concurrent compare-and-swap and stale insert rejection
PASS HTTP handlers: unauthenticated, cross-origin and changed-account rejection; owner isolation; conflicts; valid upload; schema rejection; CSP and no-store
Authentication is synthetic here. Live Better Auth / Google / two-device acceptance is NOT established.
```

Route typechecked against the existing hosted-saas auth source and pg types. Full central application build/guardrails, central review and deployed QA are NOT VERIFIED because this candidate has not been integrated there.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Return central integration branch/commit, reviewed deployment, account-provider checks, exact native build and two-device evidence here. Keep secrets/user site lists private. Public release stays pending owner approval.
