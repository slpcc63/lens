# Lens stage-two scanner correction — internal QA request

request_id: lens-ios-stage-two-wizard
revision: 2
supersedes: lens-ios-stage-two-wizard-build5 revision 1 for the corrected candidate only; preserve the build-5 failure report
state: uploaded; Apple processing and Owner Testing availability verification pending
candidate: 0.1.0 (6), Internal-only upload
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the exact build/device, grid count, each collected-profile result, field confirmation, filters, calibration/correction, preview restoration, and any compatibility blocker. Do not include passwords, private profile screenshots, names, locations, messages, or copied profile data.

## What changed

Build 6 corrects the two build-5 findings. A visible map/grid can now report profile references even when the grid itself exposes no filter fields. An open profile is collected as one sample instead of treating its repeated internal sections as multiple profiles. Collected samples remain on this device, can be forgotten explicitly, and can be accumulated before continuing to field confirmation.

This remains an internal owner test. It does not approve production changes, external TestFlight distribution, a public App Store release, or a public GitHub release.

## Focused flow

1. Confirm TestFlight shows **Lens 0.1.0 (6)** in **Owner Testing**.
2. Open the real profile grid/map, open Lens filtering, and tap **Scan current listing**. Record the visible grid-entry count. It must not report zero when visible profile markers are present.
3. If the grid does not expose filter fields, confirm Lens says so plainly and tells you to open a profile; it must not invent fields or advance to confirmation.
4. Tap **Done**, open one profile on the website, reopen Lens filtering, and scan. Confirm it adds exactly one collected profile and reports readable fields. Repeated sections inside that profile must not be counted as separate profiles.
5. Repeat with several real profiles. Confirm the collected count increases, survives closing/reopening the wizard, and does not duplicate a profile when the same profile is rescanned.
6. Tap **Continue with collected**. Confirm at least one correct field mapping; correct or disable anything wrong. Next must remain unavailable until a field is explicitly confirmed.
7. Configure filters and the unknown-value policy. Calibrate with available real examples; record exact scarcity if the site cannot supply five matching and five blocked examples.
8. Mark a misclassification, correct it, and verify the revised reasoning. Preview with **Dim blocked**, then **Show all**, and confirm all Lens-added dimming/explanations are removed. Choose **Hide blocked** only as a separate explicit check, then return to Show all.
9. Return to the grid and rescan. Where the site exposes stable profile identity, confirm collected decisions link back to the matching grid entries. Record any mismatch without sharing profile identity.
10. Use **Forget collected profiles** and confirm the local samples and dependent mappings are removed. Repeat the core controls in light/dark appearance and a large Accessibility text size.

## Stop and report

Stop on an unexpected origin, certificate/consent/login warning, damaged site layout, private-data exposure, a visible grid that still reports zero, a profile scan that creates multiple profiles, inability to continue after confirming a field, or a preview that cannot be fully restored. Screenshots are optional and must exclude all private profile or account information.
