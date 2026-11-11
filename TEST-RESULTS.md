# Verification — Lens 1.5.0

Checked November 10, 2026 (America/Los_Angeles).

## Completed

- **95 browser integration checks passed** against the generated Chrome runtime and synthetic profiles.
- **90 lower-level checks passed** for parsing, ranges, comfort fields, position icons, favorites, rule migration/evaluation, numeric preference ranges, and preference scoring.
- Both generated JavaScript artifacts pass `node --check`.
- Browser QA verified the compact injected panel, Lens blocking-status card, Doxle control icons, favorite badges, sticky actions, floating hidden-count badge, and supplied-icon Chrome popup.
- The browser suite covers pause/restore, complete pin and card wrappers, own-profile exclusion, missing-detail behavior, storage, activity windows, map position icons, favorites, Top/Bottom scoring, combined highlights, and settings persistence.
- No real profiles or account data were used.

## Pending human acceptance

Actual unpacked-extension installation, Safari/Userscripts installation, physical iPhone touch behavior, and the signed-in Sniffies layout remain unverified. Sniffies can change its internal markup or delivered fields; Lens can only filter or score information supplied to the page.
