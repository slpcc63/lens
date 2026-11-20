# Lens stage-two wizard — internal QA request

request_id: lens-ios-stage-two-wizard-build5
revision: 1
state: pending TestFlight verification
candidate: 0.1.0 (5)
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the exact build and device, every completed step, failures or page-compatibility blockers, and whether the owner accepts stage two for further release consideration. Do not include passwords, private profile screenshots or copied profile data.

## Purpose and limits

This request tests the internal stage-two profile filter wizard: scan, field confirmation, filters, calibration, correction and reversible preview. It does not approve a public App Store release or production-server changes. Build 4 remains the stage-one baseline. Build 5 stores wizard settings locally and separately for each saved site.

## Prerequisites

- Install or update to TestFlight **Lens 0.1.0 (5)** from the internal **Owner Testing** group and confirm the build number in TestFlight.
- Use a saved HTTPS site whose own terms allow the test. Sign in normally on the website; do not send Lens or the report a password.
- Navigate to a page containing several visible listing/profile cards. Stop if the origin is unexpected, a certificate warning appears, the site asks for credentials somewhere surprising, or the page layout is damaged.

## Flow

1. Open the saved site, navigate to the listing page, then open Lens's filter control.
2. Choose **Scan current page**. Record the visible-card count and the source evidence Lens shows. Confirm that scanning stays on the current top-level page.
3. Review detected fields and options. Confirm correct entries, correct at least one wrong label or selector if available, and disable an irrelevant field. Verify the confirmation screen reflects those choices.
4. Configure filters, including units where offered and the policy for unknown or missing values. Verify unknown items follow that policy rather than silently disappearing.
5. Complete calibration using five real positive and five real negative examples. If the page genuinely cannot supply that many, record the exact scarcity instead of inventing examples.
6. Mark at least one misclassification, correct it, rerun the scan, and verify the revised result is explained.
7. Preview the filter in **Dim** mode. Confirm affected cards remain present and receive a readable explanation. Choose **Show all** and verify every card is restored. Use **Hide** only as an explicit separate action, then return to Show all.
8. Close and reopen the site. Confirm the site's wizard settings persist. If safe, edit the saved site's name or URL without deleting it and verify the same stable site identity keeps its settings.
9. Repeat the wizard in light and dark appearance and with a large Accessibility text size. All actions must remain readable and reachable by scrolling. Also note whether the existing home screen becomes awkwardly oversized at the largest text sizes.

## Evidence and stopping rules

Report the device/iOS version, build number, site class (not private account details), scan counts, completed 5/5 calibration or exact scarcity, correction result, preview restoration result, appearance/text-size result, and any blocker. Screenshots are optional and must exclude private profiles, names, messages, location, passwords and account identifiers. Do not bypass certificate, consent, login or website safety warnings.
