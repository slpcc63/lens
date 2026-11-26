# Lens guided site scan and preferences — internal QA

request_id: lens-ios-stage-two-wizard
revision: 5
state: candidate; do not begin owner QA until Owner Testing availability is verified
candidate: 0.1.0 (9), source 1abdad7
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the exact build and device, the first step that failed, whether Lens opened profiles or you chose them, and whether your preferences and map state survived. Do not share profile images, handles, or credentials.

Goal: a first-time user can find the filtering controls, scan a site, choose one filter, preview it, and edit it later without coaching or rescanning.

1. Start in TestFlight, install Lens 0.1.0 (9), and open a saved site. If the site is new, dismiss the first-time message with **Continue to [site]**. Verify you can browse normally, including opening the site's own favorites if available, with no scan.
2. On the site map, tap **Lens filters** in the bottom-right toolbar. For an unscanned site, **Scan site** should be the primary action and **Set preferences** should be disabled. If you've already set up that site, look for **Re-scan site** and enabled **Set preferences**.
3. Choose **Scan site** or **Re-scan site**. Verify the map remains visible. Tap **Scan map**. Look for the count and any readable fields that Lens detected. If it reports no entries, verify it tells you how to retry; then report the result.
4. Follow the on-screen direction with **Next**. If Lens offers automatic navigation, check whether it opens a profile on this site. Otherwise open one on the map manually. Check that the profile stays visible while you confirm it and choose to scan. Try another profile. When a possible mismatch appears, verify the source profile stays scrollable and you can correct the value or skip it.
5. Verify successful scans advance the count and a failed scan does not. If a stable duplicate is detected, expect a clear message. Once Lens has a usable profile, try **Finish with what Lens found**, or finish all five. Verify both routes return to the Lens filters menu and enable **Set preferences**.
6. Open **Set preferences**. Choose a range or an available option. Check there is no per-field unit selector or missing-data selector. If a filter is missing, use **Missing a filter?**, open a relevant profile, and scan it. You should be able to return to preferences with your existing edits.
7. Tap **Preview filters** and return to the website map if asked. Check whether Lens can explain a dimmed marker and how many entries it couldn't fully check. Use **Show everyone** to see the comparison. Try **Leave without saving**, reopen preferences, and verify the previous saved filters are intact. Repeat with **Save preferences**, then reopen and check your choices.
8. From the Lens home screen, open the gear icon and check **Measurement units** and **Show profiles with missing details**. Changing units should preserve the meaning of any existing ranges. Missing details are shown by default.
9. On a disposable test site's browser screen, open the top-right gear, choose **Reset filtering setup**, and cancel at the confirmation. Your preferences should still be present. If you then confirm the reset, **Set preferences** should be unavailable again, while the saved site and its website session remain available.

Stop at the first mismatch that prevents progress. Verify the live site can open a profile automatically before describing automatic navigation as supported on that site. The manual path remains available.
