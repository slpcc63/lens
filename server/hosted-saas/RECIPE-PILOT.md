# Sniffies recipe pilot

The integration is live on the isolated hosted-saas Lens preview. Hosted source is `91937d8` on `codex/lens-account-sync`, deployment `dpl_DEMZbww9FAnjXxyYcyBU3AMjof2X`. The original candidate below remains in this repository as implementation history. The deployed route requires the exact Git preview branch and the existing controlled-preview configuration.

The app offers **Review and share site recipe** after an eligible local Sniffies scan. The contribution contains site, recipe version and an allowlisted list of field tags such as `map:age` or `profile:height`. The API accepts only Age, Height, Weight and Position tags with map or open-profile scope. Individual values, identifiers, preferences, photos, site addresses and browsing data are not accepted. A verified Doxle account is required for a vote. Storage uses a keyed account reference to replace that account's existing vote. Recent identical recipes need two distinct accounts and a unique lead; tied or expired votes yield no recipe. The 90-day voting window does not delete old database rows.

Fetching a recipe requires no account. Lens makes the lookup after a Sniffies map scan and offers to use the shared recipe only when all of its map tags are supported by observations on the current map. It enables map-readable filters using the current device's data. A profile-only, missing, conflicting or unverified recipe leaves the existing local scan path available.

## Preview integration and QA

1. Owner approved the existing Lens preview scope on November 26, 2026. The migration ran against `lens_preview` in the dedicated controlled-preview project. The recipe table permits read, insert and update to the existing preview app role.
2. The deployed route uses existing server-side Lens preview settings. It checks the database host and database name before connecting and uses a recipe-specific HMAC domain with the preview's server secret. No Vercel environment changes or production changes were made.
3. Live checks returned `404 No agreed recipe` for an empty lookup and `401 Sign in required` for an unsigned valid contribution. Build 10 pins `LensRecipePilotURL` to the verified deployment. Hosted two-account testing is pending. The preview currently has one verified account.
4. On two independent verified test accounts, open Sniffies in Lens, scan the map, scan profiles, and review the contribution before tapping **Send site recipe**. Check the first submission (and repeating it from the same account) does not make the recipe available. Submit a matching recipe from the second account. On a third saved-site setup, scan the map and check whether **Use shared recipe** appears. Check that an incompatible layout keeps local scanning available. Never include real profile data in test evidence.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the preview deployment and exact internal build, two independent contributions, third setup result, fallback and any blocker. Omit identities, secret settings and individual profile data.
