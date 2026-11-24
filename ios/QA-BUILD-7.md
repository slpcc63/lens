# Lens map-first walkthrough correction — internal QA request

request_id: lens-ios-stage-two-wizard
revision: 3
supersedes: revision 2 for build 7 only; preserve build-5 and build-6 findings
state: pending internal TestFlight upload
candidate: 0.1.0 (7), Internal only
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the exact build/device, whether the map scan stays on Scan, visible map count, each collected-profile result, and completion of fields, preferences, calibration, correction, and preview. Do not include private profile or account data.

## Correct first-run behavior

The Scan screen now demonstrates the flow in the app:

1. **Scan the map.** This counts visible profile entries only. It must remain on Scan and must not ask for preferences.
2. **Collect one open profile.** Tap Done, open one website profile, reopen Lens filtering, and scan again. Exactly one sample should be added.
3. **Repeat, then continue.** Collect several real profiles, then choose Continue with collected. Field confirmation and preferences begin only after collection.

Build 7 also treats rich map-marker labels as references rather than profile fields. This prevents map accessibility text from incorrectly advancing the wizard. The rest of revision 2’s filters, calibration, correction, preview, privacy, appearance, and text-size checks still apply.

Production, external testing, and public release remain out of scope and unapproved.
