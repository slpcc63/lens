# Lens iPhone — stage one

Scope: save HTTPS website shortcuts, open them in an embedded WebKit browser, browse and sign in, preserve website sessions, and explicitly save/fill logins with Keychain. No filtering, field detection, calibration wizard, profile collection, telemetry or cloud sync is included. Existing Safari and Brave artifacts are untouched.

## Build

Open `ios/Lens.xcodeproj`, choose scheme **Lens**, select a simulator and Run. Deployment target is iOS 17+. The project has no external dependencies. Run `python3 ios/generate-project.py` after adding Swift source files or changing the generated project settings. Simulator build:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project ios/Lens.xcodeproj -scheme Lens -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/lens-stage-one-derived CODE_SIGN_IDENTITY=- build
```

For a physical iPhone, choose the owner's signing team in Xcode; don't invent or reuse another product's provisioning identity. The new provisional bundle ID is `com.slpcc63.lens.browser`, distinct from extension identities. TestFlight upload was explicitly authorized in the source chat; App Store public release was not. Signing, App Store Connect app/bundle records, archive validation, export compliance and TestFlight processing must succeed before claiming availability.

Keychain tests require a signed simulator app. An unsigned build can compile but Keychain returns error -34018; that is not a passing credential test. The full-square 1024px app icon is a platform export of the existing 256px Lens mark on the family midnight background, not a new vector master or newly approved identity. `export-app-icon.swift` reproduces that export. Verify its actual home-screen appearance before release.

## Credentials and website data

- The website's own form handles sign-in. Lens does not capture form submissions or save passwords automatically.
- **Login → Save in Keychain** explicitly saves one username/password per exact HTTPS origin, including nondefault port. Values are not put in the saved-site JSON, logs or UserDefaults. Keychain items use `WhenUnlockedThisDeviceOnly`, are not synchronized to iCloud and do not migrate to another device.
- **Fill saved login** authenticates with device passcode/biometrics, checks the origin again, and fills only one recognizable visible same-origin top-level form. Ambiguous, embedded, signup or cross-origin-action forms are refused. The site retains control of submission. A website receiving a filled password can read it, as with ordinary sign-in; this is not isolation from the intended site.
- Browser website data uses persistent WKWebsiteDataStore, separately from Keychain. Existing Safari sessions/settings are not imported. Sites can expire/revoke sessions, reject embedded-browser/OAuth sign-in, or require repeated authentication. No bypass is implemented.
- Saved URLs strip query and fragment components to avoid retaining sign-in tokens. HTTPS is required; certificate validation is not bypassed. A saved site is a shortcut, not an allowlist: users can follow HTTPS links to other domains, and the current origin is shown above the page. Credentials are never automatically shared across those domains.
- Removing a shortcut does not delete website sessions or saved credentials. Delete a credential explicitly from that origin's Login sheet. In-app controls for clearing individual website data are not in this initial slice.

## Branding adoption

Uses the current central Doxle brand guide (updated November 16, 2026), Project Branding Rules and design-system edition 0.1 draft. Required: existing Lens identity, readable native controls, current website address and clear return navigation. Defaults: semantic Dynamic Type, pearl/midnight backgrounds and theme-specific action colors. Expressive choice: restrained family artwork rather than glowing card outlines. Native navigation/back affordances remain native for usability; prominent controls use the current full catalog.

All 200 symbol names were available for selection from `Branding/assets/symbols/transparent-icons-200`. The app includes the selected globe, key, back, forward, refresh, add, edit, lock, home, delete and sign-in resources from the 128px exports, rather than limiting selection to the old Lens subset. Unused symbols need not be embedded. The existing Lens filter mark remains separate from UI symbols. The central catalog has no newer Lens identity approval; no rename is inferred.

## Validation and acceptance

Launch with `--self-test` for synthetic checks of URL safety, save/reopen/duplicate handling, Keychain create/update/read/delete/exact-origin separation, WebKit rendering and refused cross-origin credential fill. Tests use disposable synthetic values only and write a non-secret report to the test app's Documents/stage-one-smoke.txt. These do not prove real-site sign-in, session survival across app termination, biometric fill, camera/location, downloads, popups or OAuth compatibility.

Human stage-one QA revision 1, request `lens-ios-browser-stage-one`, is delivered only after the exact build is available in TestFlight. Record its version/build and test: (1) save two HTTPS sites and reopen app; both shortcuts persist; (2) open a shortcut and navigate back/forward/reload; normal page operation works; (3) sign in yourself on each site and force-close/reopen; session retention or site-imposed expiry is recorded; (4) explicitly save a test login, authenticate and fill it on the same recognizable form; wrong origins/ambiguous forms receive nothing; (5) cancel authentication; no fill occurs; (6) test normal/large text in light/dark appearance; all controls remain readable/reachable. Stop on certificate errors, missing consent or unexpected password destinations. Never provide real passwords or profile screenshots in reports. Stage two remains deferred until owner review.

## Project metadata gap

Canonical repository is verified as `https://github.com/slpcc63/lens`. `.compass/project.yaml` and `.compass/production.yaml` are missing. The shared shannon-compass connection profile and repository standard were read; a stable hosted Compass project ID/authenticated project read has not been verified. No ID, endpoint, enrollment or migration receipt is invented. This is a recorded release-readiness migration gap, not a reason to overwrite historical records or contact retired Momentum. No hosted data writes are authorized by this implementation.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report exact build/commit, simulator and real-device results, TestFlight processing/link status, site compatibility blockers, metadata/signing gaps and the owner's stage-one decision here. Discuss stage two only after that review.

## Build 2 local additions

Site settings edit the same stable site record rather than remove/readd it. The share extension accepts HTTPS URLs into an App Group inbox, then Lens imports them on foreground. Run `python3 ios/generate-project.py` after source/target changes. Physical distribution requires the existing team to provision `group.com.slpcc63.lens.browser` for both `com.slpcc63.lens.browser` and `com.slpcc63.lens.browser.share`; simulator success is not distribution-signing proof.

The account-name setting is a reminder only, not a verified Apple Passwords entry selector. The previous password interface is removed; dormant vault code/data are retained to avoid deleting credentials. Normal website sign-in/session behavior stays in WebKit.

Account sync is an undeployed integration candidate; see `server/hosted-saas/README.md`. No sync URL is enabled in the shipped project configuration yet. Do not describe this build as already syncing across devices.


## Build 4 preview sync and inbox fix — November 19, 2026

Supersedes earlier disabled-sync state for this candidate only. Version 0.1.0 (4) embeds the tested preview endpoint in explicit Lens/Info.plist. Exact-host/main-frame/path checks remain; native upload checks derive the same configured origin. The existing account store UUID, site data path, bundles and App Group remain unchanged. Missing share inbox directories are initialized as normal empty inboxes; pending requests and existing sites remain.

30 native simulator checks pass (BUILD-4-NATIVE-CHECKS.txt), including real preview signup/sign-in/native bridge transfer in both directions using synthetic accounts and separate WebKit stores. Mobile form adaptation runs only on the exact first-party preview sign-in paths, using platform fonts and existing Doxle design-system 0.1 defaults; no artwork changed. The final archive signature and packaged build/URL were verified. Build 3 uploaded successfully, then a mobile layout problem was found; final QA targets build 4. Build 4 upload/processing/group verification remains pending until recorded in the source handoff. No owner physical-device acceptance or public-release claim.

QA: QA-BUILD-4.md, request lens-ios-preview-sync-build4 revision 1. Keep previous submitted build-2 QA separate. Production server and public release remain unchanged. Existing Compass metadata migration gap remains.


Build-4 availability verified: App Store Connect Owner Testing shows 1 tester / 4 builds; 0.1.0 (4) Internal is Testing, UUID ab4777ab-a16f-4568-9d6a-c20bd1fba150. Processing/browser-auth blocker resolved. No duplicate upload/assignment or public release action. Stage-two build handoff: WIZARD-HANDOFF.md.

## Build 5 stage-two wizard candidate — November 20, 2026

Version 0.1.0 (5) adds the local, per-site setup wizard described in `WIZARD-HANDOFF.md`: bounded current-page scanning, field confirmation and correction, filters with explicit unknown/missing handling, real 5-positive/5-negative calibration, correction and rerun, and reversible dim/show/hide preview. Settings are versioned separately from the build-4 account schema; production and public release remain unchanged.

All 36 signed simulator checks pass (`BUILD-5-NATIVE-CHECKS.txt`), covering the stage-one regression suite, preview sync, wizard model, persistence, generic scanner bridge and reversible preview behavior. Internal human QA is `QA-BUILD-5.md`, request `lens-ios-stage-two-wizard-build5` revision 1. Actual-site compatibility, physical-device behavior and owner acceptance remain unverified until that request is completed. At Accessibility XXXL, the pre-existing home screen is scrollable but visually oversized; owner QA should record whether that presentation is acceptable.
