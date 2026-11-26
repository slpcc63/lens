# Sniffies recipe pilot

This is an integration candidate for the existing hosted-saas Lens preview. It is off by default. The server requires a preview deployment and explicit pilot configuration. Do not enable or migrate production.

The app offers **Review and share site recipe** after an eligible local Sniffies scan. The contribution contains site, recipe version and an allowlisted list of field tags such as `map:age` or `profile:height`. The API accepts only Age, Height, Weight and Position tags with map or open-profile scope. Individual values, identifiers, preferences, photos, site addresses and browsing data are not accepted. A verified Doxle account is required for a vote. Storage uses a keyed account reference to replace that account's existing vote. Recent identical recipes need two distinct accounts and a unique lead; tied or expired votes yield no recipe. The 90-day voting window does not delete old database rows.

Fetching a recipe requires no account. Lens makes the lookup after a Sniffies map scan and offers to use the shared recipe only when all of its map tags are supported by observations on the current map. It enables map-readable filters using the current device's data. A profile-only, missing, conflicting or unverified recipe leaves the existing local scan path available.

## Preview integration and QA

1. Obtain the shared backend's scoped migration and preview integration approval. Reuse the existing `slpcc63/hosted-saas` Lens preview; do not modify its production route or environment. Review its instructions and use its authorized integration branch and checks.
2. Apply `migrations/002_lens_recipe_votes.sql` using a direct connection to the isolated Lens preview database. Configure `LENS_RECIPE_DATABASE_URL` for route traffic, a stable secret of at least 32 characters in `LENS_RECIPE_VOTER_SECRET`, and `LENS_RECIPE_PILOT=1` on the intended preview branch only. Keep the secret and connections server-side.
3. Deploy the candidate recipe route and retain the existing account portal and sign-in. Check that the unauthenticated lookup returns no recipe before votes and authenticated contributions require verified accounts. After validating the exact preview deployment, add `LensRecipePilotURL` to the internal iOS build with that deployment's `/api/lens/recipes` URL.
4. On two independent verified test accounts, open Sniffies in Lens, scan the map, scan profiles, and review the contribution before tapping **Send site recipe**. Check the first submission (and repeating it from the same account) does not make the recipe available. Submit a matching recipe from the second account. On a third saved-site setup, scan the map and check whether **Use shared recipe** appears. Check that an incompatible layout keeps local scanning available. Never include real profile data in test evidence.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the preview deployment and exact internal build, two independent contributions, third setup result, fallback and any blocker. Omit identities, secret settings and individual profile data.
