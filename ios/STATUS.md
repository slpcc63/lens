# iPhone stage-one checkpoint — November 18, 2026

Implementation: saved HTTPS site shortcuts, embedded WebKit browsing with back/forward/reload and visible origin, persistent website data, explicit per-origin save/delete in Keychain, authenticated conservative same-origin form fill. No stage-two detector, filters or wizard. Existing extensions unchanged.

Validation: signed simulator build succeeded. All 14 synthetic smoke checks passed on the corrected build (URL safety/token stripping, saved-site persistence/duplicate rejection, Keychain create/read/update/delete and port isolation, WebKit rendering, rejected wrong-origin fill and unchanged fields). Native UI walkthrough saved Example, opened its HTTPS page, confirmed saved shortcut persistence across relaunch/update, found and fixed the blank first-presentation login sheet, and checked its corrected controls. Light and dark UI were inspected; the dark primary-action contrast was corrected and visually rechecked. Native standard Dynamic Type is used; expanded-text and real-device accessibility acceptance remain pending.

The final signed iPhone archive succeeded at `/private/tmp/Lens-0.1.0-1-final.xcarchive`, version 0.1.0, build 1. This is a signed archive, not proof of TestFlight upload or availability. The simulator's successful tests do not establish third-party account sign-in, Face ID/passcode interaction, actual website session survival, OAuth/popups/media/location compatibility or owner acceptance. Those are the stage-one TestFlight acceptance checks.

Apple Developer bundle ID `com.slpcc63.lens.browser` was registered successfully on the existing owner team. The owner signed into App Store Connect. No Lens App Store Connect app record, upload, beta build or public release has been completed. The unfinished New App form was canceled, so do not assume an app record exists. A later browser access attempt encountered another active window; a request to bring the signed-in App Store Connect window forward is pending. Continue only in the Apple setup window and preserve unrelated windows.

Source recovery: iCloud offloaded newly created source files, blocking file reads and rebuilds. A download was requested. Exact authoring inputs were recovered from this chat's tool log into `/private/tmp/lens-stage-one-recovered`, preserving the originals. Selected UI assets came from the verified November 15 full-catalog distribution snapshot; the unchanged Lens mark was retrieved from its immutable canonical GitHub commit. The built fixes were copied back into the working tree. Keep the temporary source until the repository changes are durably committed. Do not treat the original unsigned Keychain failure (-34018), failed interrupted build or failed simulator launch as passing tests.

Branding uses current central Doxle family guidance and edition 0.1 draft conventions. Symbols were selected from the full 200-icon catalog. The app icon is an opaque 1024px platform export of the existing Lens raster mark, with its native source-resolution limitation preserved in README. No product rename or new identity approval is inferred.

Project metadata: canonical GitHub verified as slpcc63/lens. Required `.compass` identity/production guide remain a migration/readiness gap because a stable existing hosted project ID has not been verified. No IDs, hosted writes or coverage receipts were invented. Momentum remains retired.

Next: complete the Lens | Doxle App Store Connect record for this exact registered bundle, export/validate/upload the approved TestFlight build, verify Apple's processing, enable only the intended owner test access, and give exact TestFlight steps/build identity. Do not claim completion before availability is verified. Public App Store/GitHub release remains unapproved. Discuss stage two after owner stage-one review.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Return exact source/build/archive identity, test evidence, App Store Connect app ID, upload/processing status, owner testing result and remaining blockers here. Never include credentials or private profile information.

## November 19 superseding local candidate — build 2

Source implementation: edit a site's name/URL without changing UUID/order; optional account-name reminder (not verified Apple Passwords selection); gear entry and home context-menu Edit site; explicit purple Sites return with native pop gesture hidden; removed separate password area; Add to Lens share extension with HTTPS review and token stripping; per-request App Group inbox with import on foreground. Existing websites/sessions and Keychain records are preserved.

Shared Doxle identity inspected in Cadence/Sentinel and canonical hosted-saas. Account sync client and server integration candidate prepared in `server/hosted-saas`; live endpoint is absent (HTTP 404). Client remains disabled until server acceptance/configuration. Manual snapshot upload/download, expected-revision conflicts, stable account ownership, backup before local replacement, isolated first-party account WebKit store, origin-checked bridge. No passwords/cookies/history/profiles sync. This does not establish live/two-device sync or Google sign-in compatibility.

Verification: signed simulator app and embedded share extension build passed; 21 local synthetic checks passed (including old-format migration/edit identity/collision/share inbox). Native UI edited/saved the Example site; swipe remained in website and explicit Sites returned home. Safari share sheet showed Lens, opened Add to Lens with example.org, and saving imported the shortcut into Lens. Dark UI checked in the walkthrough. Final additional origin guard and visible Sites text compiled; those minor final changes were not separately visually reinspected. Expanded text/light-theme/new-device testing remain beta QA.

Server: 5 unit tests passed; actual temporary loopback PostgreSQL migration/concurrency/owner isolation and HTTP handlers with synthetic auth passed; TypeScript route check against existing shared auth source passed. No production migration, shared account changes, server deployment, TestFlight upload, push or public release performed in this session. Apple App Group/share bundle distribution provisioning remains to be verified for build 2. Source changes are local until committed/pushed separately.

Branding: preserves Lens identity and Doxle edition 0.1 draft semantic foundations. Purple Sites return adapts family violet for readable text. Uses native system symbols for small navigation/settings controls as allowed by the style guide; full-catalog existing image resources remain. No naming/identity replacement.

Next: central auth/database integration review, deploy/test controlled server candidate, verify real sign-in and two-device sync, provision share App Group, archive and deliver build 2 for owner QA. Stage-two wizard/filtering remains deferred. Required .compass identity/production metadata remain the previously documented migration gap; no identity ID or hosted enrollment invented.


## Build 4 preview sync and inbox fix — November 19, 2026

Supersedes earlier disabled-sync state for this candidate only. Version 0.1.0 (4) embeds the tested preview endpoint in explicit Lens/Info.plist. Exact-host/main-frame/path checks remain; native upload checks derive the same configured origin. The existing account store UUID, site data path, bundles and App Group remain unchanged. Missing share inbox directories are initialized as normal empty inboxes; pending requests and existing sites remain.

30 native simulator checks pass (BUILD-4-NATIVE-CHECKS.txt), including real preview signup/sign-in/native bridge transfer in both directions using synthetic accounts and separate WebKit stores. Mobile form adaptation runs only on the exact first-party preview sign-in paths, using platform fonts and existing Doxle design-system 0.1 defaults; no artwork changed. The final archive signature and packaged build/URL were verified. Build 3 uploaded successfully, then a mobile layout problem was found; final QA targets build 4. Build 4 upload/processing/group verification remains pending until recorded in the source handoff. No owner physical-device acceptance or public-release claim.

QA: QA-BUILD-4.md, request lens-ios-preview-sync-build4 revision 1. Keep previous submitted build-2 QA separate. Production server and public release remain unchanged. Existing Compass metadata migration gap remains.


Build-4 availability verified: App Store Connect Owner Testing shows 1 tester / 4 builds; 0.1.0 (4) Internal is Testing, UUID ab4777ab-a16f-4568-9d6a-c20bd1fba150. Processing/browser-auth blocker resolved. No duplicate upload/assignment or public release action. Stage-two build handoff: WIZARD-HANDOFF.md.

## Stage-two wizard vertical slice — November 20, 2026

Review branch `codex/ios-stage-two-wizard` starts from handoff commit `58baafb`. The current local candidate adds an explicit five-step wizard from the open website: scan the visible loaded listing; confirm, correct or disable detected fields and option mappings; configure units, allowed values and an explicit missing-value policy; calibrate with up to five real matching and five real blocked samples without manufacturing examples; and preview with reversible Show all / Dim blocked / Hide blocked controls. Hide is never selected automatically.

The detector is one bounded main-frame DOM structure/text/accessibility-label scanner, not a per-site adapter. It does not inspect photographs, form values, messages, passwords, network traffic, canvas content or cross-origin frames. Emoji including eggplant and peach are visible evidence that can suggest a position mapping; the user must confirm or correct it. Scans identify the exact page/origin and visible card count, and zero-result scans state the limitation instead of claiming compatibility.

Confirmed mappings and filters use a separate versioned `Lens/wizard/v1/<saved-site-UUID>.json` file. Existing build-4 site JSON, stable IDs, cookies, sessions, account-sync schema and authentication are unchanged. Editing a saved URL therefore preserves the wizard configuration. Preview mutations are limited to detected profile elements in the current page; Show all restores Lens-added attributes and any pre-existing title. A debounced observer reapplies the selected preview to already-tagged dynamic elements, while genuinely new profiles require the visible Rescan action.

Verification: unsigned generic-simulator compile and locally signed simulator build succeeded. The signed self-test reports 28 passes: all preserved local build-4 checks plus two differently structured synthetic listings, generic age/body/activity/emoji-position suggestions, per-site save/reopen, blocked-only dimming and full Show all restoration. Dark-mode native inspection confirmed the browser entry point, Step 1 scan screen and honest zero-result field screen. Actual-site compatibility, light appearance, large text, physical-device behavior, real calibration quality and owner acceptance remain unverified. No TestFlight upload, server change, production change, public GitHub/App Store release or Compass write was performed. The existing missing `.compass` identity/production guide remains a release-readiness gap.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Return implementation commit/PR, actual wizard behavior, signed simulator evidence, beta availability and unresolved compatibility/accessibility limits here. Do not infer public release or owner acceptance.

## Build 6 scanner correction — November 22, 2026

Owner testing of build 5 established two actual-site failures: the visible grid returned zero, while an open profile was treated as several profiles and could not continue. Build 6 changes the generic detector and wizard flow without adding a site-specific adapter. It recognizes visible grid/marker references even when their fields are not exposed, reports that limitation honestly, collects one open profile at a time, persists up to 100 generic-titled samples locally in the existing protected per-site wizard file, accumulates field evidence, and requires an explicitly confirmed mapping before filters. The owner can forget the collected samples and dependent mappings in the wizard.

Verification: both unsigned and locally signed simulator builds succeeded. The signed self-test reports 40 passes, preserving the prior safety/sync checks and adding marker-grid counting without invented fields, single-profile collection despite repeated internal rows, expected field proposals, local sample persistence, and stable-identity preview linkage. These are synthetic compatibility checks; actual-site correction and owner acceptance remain pending. QA is `QA-BUILD-6.md`, request `lens-ios-stage-two-wizard` revision 2.

Source commit `5268155` is pushed to `codex/ios-stage-two-wizard`. Signed archive `/private/tmp/Lens-0.1.0-6.xcarchive` succeeded. The exact 0.1.0 (6) package was exported with `testFlightInternalTestingOnly=true`; Xcode reported “Upload succeeded” and “Uploaded package is processing” at November 22, 2026 7:37 PM Pacific. Availability was verified separately after processing, as recorded below.

Availability verified November 24, 2026: App Store Connect shows **Build 6 Internal**, status **Testing**, group **Owner Testing**, expiring in 89 days, UUID `1134fad7-c3ec-49da-a231-41ddeb2b7a88`. Shannon performed the Owner Testing assignment and Codex verified the resulting state. The internal QA request is now ready to execute; owner acceptance remains pending. Production, external testing, public App Store release and public GitHub release remain unchanged and unapproved.

## Build 7 map-first correction — November 24, 2026

Owner testing of build 6 showed that scanning the map could advance directly to preferences. Build 7 makes map context reference-only even when marker accessibility labels contain age, height, weight, body or position-like text. An open profile dialog can still be collected as a detail sample. The Scan screen now contains a three-step demonstration: scan the map; tap Done and collect one open profile; repeat and only then continue to field confirmation and preferences. The completion notice explicitly says preferences are not ready after a map scan.

Signed simulator build succeeded and all 40 checks passed. The map regression fixture intentionally includes rich marker labels and verifies that the map returns two references with no proposed mappings; the existing single-open-profile, persistence, preview, sync and safety checks remain green. QA is `QA-BUILD-7.md`, request `lens-ios-stage-two-wizard` revision 3.

Source commit `29185ae` is pushed to `codex/ios-stage-two-wizard`. Signed archive `/private/tmp/Lens-0.1.0-7.xcarchive` succeeded. The exact 0.1.0 (7) package was exported with `testFlightInternalTestingOnly=true`; Xcode reported **Upload succeeded** and **Uploaded package is processing** at November 24, 2026 1:24 AM Pacific. Apple processing, Owner Testing assignment/availability, actual-site correction and owner acceptance remain pending. Production, external testing and public release remain unchanged.

## Build 8 Position badge guide — November 25, 2026

Owner feedback showed that people looking at map badges could not recognize the underlying Position words in field confirmation. Build 8 adds an inline example guide for eggplant and peach and separates the site-reported option from the editable Lens filter value. The actual badge meaning remains subject to user confirmation. The view uses the existing native layout and Doxle edition 0.1 draft foundations.

Source `da8f8cb` is pushed to `codex/ios-stage-two-wizard`. The build and signature verification succeeded for 0.1.0 (8), including the share extension. All 32 local simulator checks passed on retry after a synthetic WebKit page timed out. The signed archive is `/private/tmp/Lens-0.1.0-8.xcarchive`. Xcode reported **Upload succeeded** and **Uploaded package is processing** on November 25 at 6:02 AM Pacific, with `testFlightInternalTestingOnly=true`. Owner Testing availability and physical-device acceptance are unverified. The test request is `QA-BUILD-8.md`, revision 4.

## Build 9 guided setup and separate preferences — November 25, 2026

The owner-reviewed flow now starts from a labeled Lens filters entry. The two-action menu enables Set preferences after a successful site scan and thereafter offers Re-scan site. The site remains visible and scrollable during setup. Lens scans the map for entries and readable details, then guides the user through profile samples. Five distinct samples is a target, with early finish once Lens finds usable details. Clear values become filter options automatically; possible mismatches can be corrected or skipped while the source profile is open. Automatic navigation is restricted to explicitly exposed same-origin profile links; if those are unavailable or fail, the user can choose a profile directly.

Preferences can be reopened without rescanning. A missing-filter scan preserves preference drafts. Measurement units and missing-detail handling are app-wide. Preview dims entries it can evaluate, reports unknowns, offers examples, and can be exited without saving. Site Settings provides a confirmed reset of Lens filter setup. Saved website shortcuts, normal site browsing and sign-in do not require filtering. The existing Lens identity and native Doxle edition 0.1 foundations are preserved.

Source candidate `1abdad7`. Debug build and signed archive `/private/tmp/Lens-0.1.0-9-candidate.xcarchive` verified, including build 9 in the app and share extension. All 36 local simulator checks passed on retry after a synthetic WebKit load timeout. The new checks cover separate map observations, safe same-site link selection, mismatch detection and unit conversion. Actual Sniffies auto-opening, readability of map fields, marker matching and owner acceptance remain pending live-device QA. Continue with `QA-BUILD-9.md`, revision 5, once Owner Testing availability is verified. The existing Compass repository metadata migration gap is unaffected.
