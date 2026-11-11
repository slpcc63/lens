# Safari installation and updates

## Current status

Option B uses a complete locally installed script and Userscripts' own manual update controls. It does not fetch code whenever Sniffies opens. GitHub being unavailable should leave the installed code usable; actual device failure testing is pending.

Canonical build output: **`dist/sniffies.user.js`**. Configured stable installation, updateURL and downloadURL:

https://github.com/slpcc63/lens/releases/latest/download/sniffies.user.js

**This URL is reserved, not active until the first approved release.** Do not use the development source or `main` as the update channel. Release-asset redirects, download response handling and caching still require Userscripts 1.8.6 (113) device verification. If Safari only downloads the attachment and never shows script text/install controls, stop and report it; hosting compatibility is not yet established. Do not substitute a runtime bootstrap loader.

## First installation (after release approval)

1. Install Userscripts from Apple's App Store. Enable it in iPhone Settings → Apps → Safari → Extensions → Userscripts (older iOS: Settings → Safari). In the Userscripts app, select a scripts directory once with **Set Userscripts Directory**. This may be local or iCloud; future updates should not need manual file copying.
2. Open the stable URL above in a regular Safari tab. Expected: userscript text or a supported Userscripts install prompt. Open Safari's page/Extensions menu → **Userscripts**. Grant it access to the hosting page if requested.
3. Tap its installation prompt. Confirm the name **Lens for Sniffies** and the two sniffies.com match patterns; tap **Install**. Expected: one installed Lens script. If an existing copy is reported, use the migration steps below instead of creating a second enabled copy.
4. Open https://sniffies.com, open **Userscripts**, allow site access, enable Lens, then reload. Expected: the Lens floating control; Settings → Technical status shows the approved version. Do not share account credentials or profile screenshots in reports.

## Migrate the old manually copied script

The old script has no updateURL, so **Check Updates cannot upgrade it until it receives the new metadata once**.

1. Keep the current working script as a backup outside the active scripts directory. Record your filter settings and favorites privately; never clear Safari website data. For minimal risk, first exercise installation on a spare Safari profile/device with synthetic favorites.
2. Open the approved release URL and follow the install prompt. Lens deliberately retains its existing name, namespace and browser-storage keys. Confirm any replacement prompt only if it names **Lens for Sniffies**. Replacement behavior for a manually named file is pending actual device verification.
3. If Userscripts reports a name conflict or shows two Lens entries, cancel. Keep the old entry available. On Mac, the Userscripts editor can replace the existing entry's code with the approved artifact and **Save**; this is a one-time migration fallback. Do not blindly delete both entries or copy files repeatedly.
4. Enable only one Lens entry, open Userscripts once and reload Sniffies. Confirm settings, favorite labels, floating position and filter behavior before retiring the old backup. If any are missing, stop and use rollback below.

## Future updates without file copying

1. In Safari, open **Userscripts** and its updates view (update-arrow icon). With the old working version installed, tap **Check Updates**. Expected: **Lens for Sniffies** appears when the approved GitHub release has a higher version.
2. Tap **Update** beside Lens. Prefer this over **Update All**, which also affects unrelated scripts. Open Userscripts once, reload Sniffies and check Technical status and saved settings. On Mac, the full editor also has an **Update** button for an individual eligible script.
3. If no update appears, confirm GitHub is reachable and the installed script has version/updateURL metadata. A same or lower version is not an update. A stale cache or failed request is not permission to remove a working install. Stop and report the versions and visible error if retrying later does not resolve it.

## Rollback

Use a known-working backup or a prior approved release's **sniffies.user.js** asset from https://github.com/slpcc63/lens/releases. A prior version's fixed URL is `https://github.com/slpcc63/lens/releases/download/vVERSION/sniffies.user.js` (replace VERSION with the exact approved tag). Manual update checks do not downgrade.

Install/reinstall the chosen prior version through the same Userscripts prompt, confirming replacement only for Lens. If downgrade replacement is refused, cancel and restore the saved original entry on Mac rather than deleting website data. Keep only one enabled Lens entry. Reload and verify the prior Technical status and saved settings. Future versions can have data migrations; only roll back across versions explicitly tested as compatible. For 1.5.1 versus 1.5.0 the runtime and storage keys are identical apart from displayed version labels; physical-device rollback is still pending.

## Evidence and limits

The [pinned v4.8.6/iOS 1.8.6 documentation](https://github.com/quoid/userscripts/blob/v4.8.6/README.md#metadata) supports version/updateURL/downloadURL and installation from Safari. [The update view](https://github.com/quoid/userscripts/blob/v4.8.6/src/ext/action-popup/Components/Views/UpdateView.svelte) contains Check Updates, Update and Update All. [Automatic checks were disabled](https://github.com/quoid/userscripts/pull/895/files); the older README's periodic-check description is stale. Automatic detection/installation is **unavailable for the targeted release line**, not verified or promised.

Device installation, signed-in execution, migration, newer-version retrieval, settings survival, offline behavior and rollback remain unverified. Exact Safari menu presentation varies by OS. Report blocked or failed steps to the Sniffies distribution chat: `codex://threads/01a1c972-14de-7132-ad54-1b614a52380e`, including tested version, step, expected/actual result and error text; omit private profiles and tokens.
