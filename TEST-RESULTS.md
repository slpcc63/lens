# Verification — Lens 1.5.0

## Distribution preparation — 1.5.1

- 90 existing Node tests and four distribution validation tests passed locally.
- Canonical `dist/sniffies.user.js` and Chrome runtime passed syntax checks.
- Release metadata, tag/version agreement, stable URLs, identity, grants and self-contained packaging validated. Invalid development/mismatched tags, changed identity/timing/grants, remote runtime dependencies and wrong channel URLs are rejected by tests.
- Generated runtime is byte-identical to the baseline `5521af4` runtime after normalizing displayed version strings. Storage keys and functional code are unchanged. The root legacy userscript is an exact copy of the canonical artifact.
- SHA-256: `ef86f50c95da03bd7cbc4340c70bde1a5322942d2a64aa6f0b08b79b930223d0`.
- The draft workflow has not been executed; no tag or release was created. Hosted CI results are distinct from these local checks.
- Device installation, signed-in Sniffies, native update retrieval, preservation on-device, offline behavior and rollback remain unverified. See [versioned device QA](docs/DEVICE-QA.md). GitHub release-asset response compatibility remains pending; its stable URL is not live.

The results below are historical 1.5.0 evidence, not repeated browser/device checks for 1.5.1.

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
