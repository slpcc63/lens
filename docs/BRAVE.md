# Brave preview ZIP — 1.5.1

The generated `dist/lens-brave-1.5.1.zip` contains the existing Chromium extension, packaged for Brave desktop. Extract it to get a `lens-brave` folder containing `manifest.json`. This is a source-branch preview, not an approved GitHub release or an automatic updater. The runtime and storage keys are unchanged from the 1.5.1 Safari distribution preparation. Building with `python3 work/build.py` regenerates the versioned ZIP from an explicit eight-file allowlist.

## Update your existing installation

1. Open `brave://extensions`. Find **Lens — Sniffies Comfort Filter**, open **Details**, and record its ID/version and loaded folder path if shown. Privately capture your current Lens settings/favorites. Copy the existing extension folder to a backup outside the folder Brave loads. Keep the existing extension installed; don't clear Sniffies website data.
2. Download the preview ZIP from the exact commit linked in the source chat and extract it. Expected: `lens-brave/manifest.json`, runtime, popup files and four icons. Do not load the ZIP itself.
3. Copy the **contents** of the extracted `lens-brave` folder into the **same existing extension folder**, replacing matching files. Do not nest the new folder inside the old one. Expected: the existing folder's `manifest.json` now says version 1.5.1.
4. Return to `brave://extensions`. Enable **Developer mode** if needed and click the circular **Reload** button on the existing Lens card. Do not Remove it or use Load unpacked to create a duplicate. Expected: same extension ID, version 1.5.1 and no errors.
5. Reload Sniffies. Check Lens Technical status, saved filters/favorites, pause/resume and normal profile interaction. Expected: 1.5.1, preserved settings and one Lens control. If anything fails, stop; restore the backup files to the same loaded folder, click Reload and reload Sniffies. Do not reset browser data.

For a first installation on a spare Brave profile: extract ZIP to a permanent folder, open `brave://extensions`, enable Developer mode, click **Load unpacked**, select the folder containing `manifest.json`, then open Sniffies. Keep that folder in place. This first-install path is not the update path for an existing install.

## Test request

ID: `lens-brave-zip`; revision: 1; state: open; project: Lens. Artifact: exact version 1.5.1 ZIP and SHA-256 linked in the source-chat handoff. Goal: confirm the package updates the existing Brave install without losing settings. No Brave QA submission for this ZIP has been received. Automated package checks do not establish actual Brave acceptance.

Complete steps 1–5 above and report pass/fail/blocked, Brave/OS versions, resulting extension version, whether its ID stayed the same and whether settings/favorites survived. Stop on unexpected errors or duplicate entries. Keep profile details and favorite labels private. A changed ZIP or procedure requires a new request revision.

report_back_to: Sniffies distribution chat  
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e  
report_back_instructions: Return step outcomes, exact tested ZIP/hash and non-sensitive error text here. Release publication remains pending Shannon's explicit approval.
