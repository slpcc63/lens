# Lens Sniffies recipe pilot — internal QA

request_id: lens-sniffies-recipe-pilot
revision: 1
candidate: Lens 0.1.0 (10), internal preview only
state: uploaded to internal TestFlight; Apple processing, Owner Testing availability, and second verified preview account pending
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the build, whether both contributions matched, the first point at which the recipe appeared, and whether the map check succeeded. Do not share usernames, passwords, private screenshots or profile values.

Goal: two distinct verified Doxle accounts can contribute the same field recipe, and a fresh Sniffies setup can use it after checking the current map.

1. Both testers install build 10 from internal TestFlight and open Sniffies in Lens. From the map, choose **Lens filters**, **Scan site** or **Re-scan site**, and **Scan map**. Scan open profiles until Lens offers a usable filter, then finish the scan.
2. Tester A chooses **Review and share site recipe**. Check that the review shows field names and whether they came from the map or a profile. Sign in to the Doxle preview account and tap **Send site recipe**. Stop and report any message about account verification or sharing being unavailable.
3. Check a fresh saved-site setup on a clean internal test device. Scan the map. A single contribution must not offer **Use shared recipe**, even if Tester A sent it more than once.
4. Tester B repeats the steps on a different verified Doxle preview account. Check whether the two listed sets of field names match. If they differ, report the disagreement; the pilot should keep ordinary setup available.
5. With matching contributions, scan the map from a fresh setup again. If the recipe matches fields the phone can read, **Use shared recipe** should appear and unlock **Set preferences** without opening profiles. If the map cannot verify the recipe, Lens should continue offering the manual scan.

Production and external testing are outside this request. Test only against the internal build and its pinned preview service.
