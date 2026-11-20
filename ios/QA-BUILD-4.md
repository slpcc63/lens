# Lens TestFlight QA — 0.1.0 (4)

Request ID: lens-ios-preview-sync-build4
Revision: 1
State: awaiting Apple processing and Owner Testing access verification. Do not begin until TestFlight offers exact build 0.1.0 (4).
Project: Lens | Doxle. Source commit 52a6bdb68feb8e86c150f0fe96156f2f5a280aa7; app com.slpcc63.lens.browser; share com.slpcc63.lens.browser.share.
App executable SHA256: 8e2120020cd3d2e66c4c815a3c3d0f2a622d50bcac09d80c7cb45d9276abae7b.

Purpose: verify the empty share inbox fix and the now-connected preview account sign-in/manual settings sync. This is internal QA, not public-release approval. Build 3 was uploaded before a mobile layout issue was found; use build 4.

Setup: keep Lens installed and update in place from TestFlight. Do not delete/reinstall, clear website data, or change your working site passwords. Your real website sessions should remain. The account screen explicitly labels this as a preview. It uses the existing shared account implementation with a separate controlled preview account database; an account on the main live service is not guaranteed to exist here. Use a preview account with its own unique password. No payment, subscription, email verification or Google sign-in is required for this test. Do not use a dating-site password for this account.

1. In TestFlight, update Lens | Doxle to **0.1.0 (4)**. If it is absent, report Blocked; build 2/3 results do not test this artifact.
2. Open Lens and reopen it once. Expect existing shortcuts/list order to remain and no red missing SharedSites-folder error. Open a previously signed-in website; record whether its session remains. If sites unexpectedly disappear, stop and report without reinstalling.
3. In Safari, share a harmless public HTTPS page not already saved. Choose Lens / Add to Lens, review the address/name, save, then return to Lens. Expect one new shortcut. Share it again; expect no duplicate and no spurious error. Do not send private site lists/screenshots in the report.
4. Tap the account icon. Expect the preview label and a working sign-in/create-account form, not “Account sync is not available yet.” Labels, inputs and submit controls should fit; scroll vertically to reach all controls. Create a preview account, or choose Sign in if you already have one on this preview. Keep passwords/codes out of chat.
5. Expect the Lens account sync page after sign-in. Review the upload confirmation, which sends saved site names/addresses and preferred-account reminders to your private preview account. Passwords, website cookies and browsing history are excluded. Choose Replace account settings with this device, then confirm. Expect “Device settings saved to your account.” Uploading intentionally replaces that account's previous settings; stop if the account identity is unexpected.
6. If you have a second iPhone/iPad, install the same build and sign in to the same preview account. Use a second-device Lens installation with no unique saved-site list to lose; otherwise report this step Blocked. Choose Use account settings on this device, review the replacement confirmation, then confirm. Expect the same sites/names/reminders. This intentionally replaces that device's Lens list and keeps a local backup. Website sessions/passwords do not transfer; log into websites separately on that device.
7. On device 2, edit the harmless test shortcut, upload its settings, then refresh the account page on device 1 and download after reviewing the confirmation. Expect the edit and existing stable shortcut identity/list order to remain. If a stale-copy warning appears, refresh and review rather than repeatedly forcing uploads. Stop on an unexpected empty or different account copy.
8. Sign out of the preview account. Expect website shortcuts and website sign-ins to stay on the device. Reopen the account screen and verify the sign-in form is shown. Check readability in your normal light/dark and text-size settings.

Report numbered Pass / Failed / Blocked outcomes, exact 0.1.0 (4), and error text. If you have one device, report the second-device steps Blocked; do not claim them passed. No passwords, session cookies, private profiles or account recovery codes in reports. These results do not authorize public release.

Agent evidence: 30 native simulator checks pass, including missing/empty inbox regression, existing saved-format compatibility, backups, isolated WebKit account signup/sign-in, real native upload/download bridge in both directions, stable identity and sign-out. Mobile form clipping was corrected and visually checked on the dedicated iPhone simulator. Two independent WebKit stores on one simulator are not two physical-device acceptance.

report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Reply here with exact build, numbered outcomes and errors. Keep production unchanged and public release pending separate approval.
