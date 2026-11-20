# Lens stage two — profile-field and filter setup wizard

## Assignment and authority
Shannon requests another chat start building the iPhone wizard described below. Begin with a task estimate and obey the current AGENTS.md estimate cutoff; do not revive the retired 10-point thread cap or Momentum requirements. This handoff does not authorize public release, production changes, a new repository, paid services, or contacting other chats. Internal TestFlight delivery is already authorized after testing; verify actual processing and existing owner-group access before calling a build available.

Owner explicitly wants stage two started now. Keep outstanding build-4 physical QA visible; do not demand another stage-two approval merely because older docs say stage two was deferred. No wizard implementation has been started by this handoff.

## Canonical sources and current state
- Existing public repository: https://github.com/slpcc63/lens . Reuse it; never create a duplicate. Current review branch codex/ios-stage-one; draft PR https://github.com/slpcc63/lens/pull/2 targets codex/safari-distribution. Inspect actual remote/dirty state before edits. Prefer a new wizard review branch from the current native review tip; do not merge or rewrite existing branches.
- Workspace: /Users/shannonphillips/Documents/ChatGPT/Sniffies/lens . iCloud can stall Git/file reads. An isolated canonical clone at /private/tmp/lens-build4-source holds committed/pushed native changes; the original workspace has matching implementation edits but old Git metadata and needs careful reconciliation. Do not discard them or assume all /tmp artifacts survive.
- Native implementation commit: 52a6bdb68feb8e86c150f0fe96156f2f5a280aa7. Documentation tip before this handoff: bc679f2671c19c8c2944ae7910aa9eaa9b19ab21.
- TestFlight **0.1.0 (4)** is now verified **Testing**, Owner Testing group fbb9287e-8743-41d8-80ad-da329de643da, 1 existing tester, 4 builds. Build UUID ab4777ab-a16f-4568-9d6a-c20bd1fba150. Do not re-upload/reuse build 4. Apple app ID 6836648807; team 76GL5MBUM8; bundle com.slpcc63.lens.browser; share com.slpcc63.lens.browser.share; App Group group.com.slpcc63.lens.browser.
- Build 4: saved HTTPS sites, in-place name/URL editing, optional account-name reminder, persistent website sessions, purple Sites return, website history gestures, Add to Lens share extension, fixed empty/missing SharedSites inbox, connected manual preview account sync and mobile sign-in layout. Separate password form removed; dormant vault retained to preserve data. Preferred username is not a verified Apple Passwords default selector.
- 30 native simulator checks passed, including real preview sign-in and both-direction native bridge transfer between isolated WebKit clients. These are on one simulator, not physical multi-device acceptance. Owner reported “Everything seems to work fine” from a phone; exact build/test scope was not established. Preserve this feedback without inventing formal acceptance. See ios/QA-BUILD-4.md and ios/BUILD-4-NATIVE-CHECKS.txt.

## Required wizard flow — owner decisions
1. **Scan the current profile listing first.** User opens a saved site, signs in normally, navigates to its listing (cards/grid/list/map), then opens setup. Suggest available fields and detected options/values, with source-label/value evidence. Say which visible/loaded sample was scanned; do not claim a complete site catalog.
2. **Confirm or correct detection.** For every proposed field the user can confirm it, disable it, or flag/change the label/source/meaning. They can add missing options and map them to the appropriate existing Lens field, or leave a field unused. Keep detected and confirmed states distinct.
3. **Set filter preferences** using confirmed fields. Show unavailable/unknown values explicitly, including units and the policy for missing values. Do not silently treat unknown as a mismatch or as confirmed absence.
4. **Calibrate with 5 matching and 5 blocked profiles**, explaining each outcome using actual field/value evidence and the relevant rule. User can say an example is classified incorrectly. Never fabricate examples to fill the quota: if fewer exist, show real counts and let the user navigate/load more.
5. **Correct mappings/detection** when a calibration mistake is caused by a wrong field or option; let the user disable that field instead.
6. **Adjust filters** and rerun calibration.
7. **Preview filtering**, initially dimming would-be blocked profiles with explanations and an easy show-all/pause/revert action. Hide only after explicit application. Reopening the wizard must preserve saved settings.

Use one generic label/value/structure detector and user-confirmed mappings, **not hard-coded per-site adapters**. User mappings may be scoped to the stable saved-site ID; that is configuration, not a site adapter. URL aliases/edits of the same saved site preserve identity and settings. A genuinely different service is a separate saved site.

Owner specifically wants emoji such as eggplant/peach detected as potential top/bottom field values across sites, rather than reserved for a Sniffies adapter. Suggest semantic mappings visibly and let the user correct them. Do not infer intimate attributes from photographs or manufacture values unavailable in the page. Inaccessible canvas/cross-origin content must remain an explicit limitation, not a fake successful scan. Broad cross-site support is a goal, not a compatibility guarantee.

## Existing field catalog and engineering entry points
Authoritative existing extension core: work/src/core.cjs. It defines comfort/substance labels (No Alcohol, No Cannabis, No Tobacco, No Poppers, No PNP, No Other Drugs, Let's Discuss), body types, role/position, activity/last-seen options, and age/height/weight/endowment ranges. Also inspect work/src/rules-part.txt and existing tests under work/tests. Distinguish hard exclusion rules from scored preference highlights. Do not silently transplant the old PNP/default missing-data choices into the new wizard without confirmation.

chrome/filter.js, dist/sniffies.user.js and the root userscript are generated outputs of work/build.py. The Sniffies runtime includes site/network-specific assumptions; reuse portable core concepts, not its response interception or selectors as the general detector. Do not change the working Brave/Safari artifacts or storage keys incidentally.

Native entry points: ios/Lens/BrowserModel.swift (WebKit), LensApp.swift (site/browser UI), SiteStore.swift (stable IDs and file compatibility), AccountSyncScreen.swift (first-party account bridge), and ios/Shared/SharedSiteInbox.swift. The wizard inspects the currently open website WebView, not the isolated account WebView. Use bounded, on-device DOM inspection, clear user initiation, main-frame/origin checks, debounced incremental observation and reversible visual changes. Do not crawl private APIs, collect passwords/messages, upload profiles, add telemetry/LLM services, or alter site authentication. Preserve map positioning, ordinary navigation, inputs, existing site/session data and accessible controls.

Persist confirmed wizard configuration locally in a separate versioned per-site store first, preserving build-4 site JSON. Plan migrations and recovery. A small first vertical slice should scan two synthetic differently structured listings, review/correct/disable fields/options, save/reopen mappings and demonstrate no per-site code. Then implement settings, real calibration, preview/apply and rescanning. Prefer a working slice over decorative placeholder screens. Continue only within the next chat's accepted estimate.

## Sync and deployment boundaries
The current account API strictly accepts schemaVersion 1 with site id/name/url/preferredUsername only. Adding mappings/filter fields directly will be rejected; do not claim wizard settings sync without a versioned, backward-compatible client/server extension and tests for old build 4. Local wizard work needs no new backend.

Existing server repository is https://github.com/slpcc63/hosted-saas on codex/lens-account-sync, draft PR https://github.com/slpcc63/hosted-saas/pull/5. Exact tested server code e12f2d5bb1ce54e763869675ef0546d75e4d3af7. Native build 4 pins https://hosted-saas-b3im5yh15-slpcc63-8889s-projects.vercel.app/api/lens . It uses shared Better Auth code with separate controlled-preview account data (neondb) and Lens settings (lens_preview). No new identity provider or subscription system is needed. Never copy credentials into this handoff or public code. Preview overrides are exact-branch scoped. Do not promote, migrate or alter production to support the wizard.

Production app.slpcc63.com remains the existing release/time-card-email-v0.1 deployment, untouched by Lens preview work. Website cookies/passwords/sessions are excluded from settings sync. Notifications and Brave automatic-store updates are separate workstreams; they are not prerequisites for the wizard.

## Required startup, validation and delivery
Read current local AGENTS.md, project roadmap/handoff, PROJECT-WORKFLOW.md and the Compass repository standard/shared shannon-compass profile. Missing .compass/project.yaml and production.yaml remain an identity/guide migration gap: obtain the real existing project ID rather than inventing it or writing to retired local Compass. Momentum is retired.

Before UI work read /Users/shannonphillips/Documents/ChatGPT/Branding/PROJECT-BRANDING-RULES.md and linked current guides/index. Preserve exact Lens identity, native conventions and data compatibility. Use the full 200-symbol Doxle catalog, not only the icons embedded in Lens; no unsolicited rebrand.

Regenerate the project with python3 ios/generate-project.py after Swift/project additions. Use a temporary non-cloud build directory if necessary. Xcode tools require DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer and normal simulator-service access. Keep meaningful regression tests for missing/ambiguous fields, option correction, units, unknown values, scarce calibration samples, new/dynamic profiles, rescans, stable IDs, restoration and unchanged login/session behavior. Verify light/dark, large text and real native interaction. Synthetic fixture tests are not actual-site or owner acceptance. Do not publish private profiles as fixtures or screenshots.

Before claiming delivery: verify the exact packaged configuration, app/extension signing, successful internal upload, Apple processing and existing Owner Testing access. Prepare versioned self-contained QA for the exact new artifact; do not reuse build-4 results for a wizard build. Keep public App Store/GitHub release pending Shannon's separate approval.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Return implementation commit/PR, actual wizard behavior, test and device evidence, exact beta availability and unresolved limits/decisions here. Do not claim public release or owner acceptance from code/test counts. This handoff does not automatically send a message or start another AI run.
