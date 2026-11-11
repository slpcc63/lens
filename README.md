# Lens

Lens is the Doxle-family comfort filter for Sniffies. It keeps filtering local to the browser, makes its blocking behavior legible, saves favorite profiles, and highlights Top and Bottom preference matches.

## Build and test

```sh
python3 work/build.py
node --test work/tests/*.test.cjs
python3 work/validate_release.py
python3 -m unittest discover -s work/tests -p 'test_*.py'
```

Load `chrome/` as an unpacked Chrome extension. The canonical Safari release artifact is **`dist/sniffies.user.js`**; the root userscript is a legacy compatibility copy, never a release input.

[Safari installation and manual updates](docs/DISTRIBUTION.md) · [Release procedure](docs/RELEASING.md)

Version 1.5.1 prepares repository distribution. No approved GitHub release exists yet. The configured latest-release URL is pending publication and Safari validation. Userscripts iOS 1.8.6 does not perform automatic update checks.

The v1.5.0 redesign uses the SLPCC63 family palette, compact layered surfaces, and supplied Doxle icon assets throughout the popup and in-page interface.

