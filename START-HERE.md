# Lens — version 1.5.0

Lens is the Doxle-family comfort filter for Sniffies. It supports Chrome on your computer and Safari on Mac/iPhone through Userscripts.

## Version 1.5.0 — Lens family redesign

- A compact, layered Lens interface now follows the SLPCC63 family palette and type/shape conventions.
- Supplied Doxle icons replace generic controls in the extension popup, floating Lens control, panel header, rule actions, favorites, and installed extension artwork.
- The status card explains what Lens is blocking, separating confirmed rule mismatches from profiles hidden while required details are missing.
- Electric blue identifies Top matches, violet identifies Bottom matches, and a dual ring identifies profiles that qualify for both.
- Ranges are collapsed by default and spacing is reduced without shrinking primary touch targets.
- Existing settings, rules, favorites, and on/off state remain compatible.

## Version 1.4.3 — map-attached markers

Favorite stars and preference colors now preserve Sniffies' own map-pin positioning, so they move with their profiles when the map pans or zooms.

## Version 1.4.2 — complete preference fields and visible matches

Top Preferences and Bottom Preferences now each store independent age, height, weight, and endowment ranges in addition to their independent comfort, body, role/position, and activity choices. Numeric preferences participate in the same equal-weight score as categorical preferences and never hide profiles.

Map matches now use a much stronger blue glow for Top, purple glow for Bottom, and combined blue-and-purple indication for both. Exact 75% still does not qualify; the score must be greater than 75%. Profiles hidden by Filters are not highlighted.

## Version 1.4.1 — compact, field-appropriate controls

- The Has/Doesn’t have builder now contains only the seven supported Comfort Level fields. Its **+** button sits at the end of the same row.
- Body type and role/position use dedicated choice grids. Activity uses a normal dropdown.
- Height minimum and maximum are native select boxes.
- Pause/resume, Settings, Help, and Close are compact controls in the panel header.
- Profile coverage, units, missing-detail behavior, button-position reset, and technical version information are on the Settings screen.
- Explanations and privacy information are on the Help screen.
- Endowment values retain their precise conversion, so an entered value such as `7` inches remains `7` after saving and reopening.

Existing rules and settings use the same storage keys and are preserved. Fetishes, kinks, and “into” are not offered yet because the current implementation has not verified stable Sniffies data fields for them.

## Version 1.4.0 — rule groups, preference highlights, and reliable favorite links

The minimized control is now a compact sliders icon. Tap it to restore the full interface; it remains movable by dragging.

The main interface has three independently saved tabs:

- **Filters** hides profiles that do not satisfy its rules.
- **Top Preferences** adds a blue highlight when strictly more than 75% of its rules match.
- **Bottom Preferences** adds a purple highlight when strictly more than 75% of its rules match.
- A profile matching both preference groups receives a blue outline with a second purple ring.

Each tab uses the same two-dropdown builder: choose **Has** or **Doesn’t have**, choose an attribute, and tap **Add rule**. Added rules appear underneath with an **×** removal control. Duplicate rules in the same tab are blocked. Empty preference groups never highlight profiles, and preference rules never hide them. Hidden profiles are never highlighted.

Age, height, weight, and endowment remain under **Advanced numeric filters** because those require minimum and maximum values rather than a yes/no rule. Existing categorical settings are migrated to the Filters tab, and all existing ranges, missing-details behavior, units, favorites, on/off state, and button position are preserved.

Newly saved favorites retain a verified `/profile/<id>` route. Older favorites are repaired only after the same identity is observed in Sniffies map/network data or on a verified profile route. If an old favorite cannot be safely repaired, its name and other saved metadata remain intact and the list shows **Open unavailable** rather than inventing a link. Re-save that favorite while its profile is open to add a verified link.

## Compact favorites repair

Version 1.3.1 removes the large favorites form from the profile. A small **☆** sits in the profile’s upper-right corner without taking up layout space. Tap it to open a **Save favorite** form in the floating panel, enter a name, and tap **Save friend**. The panel closes and the profile star fills in (**★**). Tap a filled star to edit its name or remove the bookmark.

The star and editor sit outside the profile’s clickable photo area. The editor shows only favorite controls; tap the floating Filters button to return to filter settings. Saving or removing a favorite updates both the profile star and the small gold star on supported map pins/photo cards. Map badges do not block tapping the pin. Favorites still follow your filters.

Existing bookmarks and filter settings are retained. Replace the Userscripts file, keep one copy, open the Userscripts menu once, and reload Sniffies so the old form is removed.

## Map icons and favorites

Version 1.3.0 can read position from the icons attached to map pins and photo cards, before opening a profile. It reads the dedicated position icon, not emoji someone writes in a name or bio.

- **Bottom, Submissive bottom, or Power bottom:** includes every peach, including peach + arrows (Vers bottom).
- **Vers bottom:** includes only peach + arrows.
- **Top, Passive top, or Dom top:** includes every eggplant, including eggplant + arrows (Vers top).
- **Vers top:** includes only eggplant + arrows.
- **Vers:** includes arrows alone. **Side** still matches Side only.

These same groups apply when position arrives as profile data. Multiple checked positions allow any of the selected groups. Other selected filters still apply, and missing comfort, age or other details still follow your missing-details setting. Removing or changing a map icon causes its position to be checked again.

To bookmark a friend, open their profile and tap its corner **☆**. In the floating form, enter a name and tap **Save friend**. Open **Filters → ⭐ Favorites** to reopen their profile, change the saved name with **Save name**, or **Remove** the bookmark. Saving the same profile again updates its existing bookmark. Favorites stay in the list even when filters hide their map pins; they do not override your filters. Opening a bookmark may reload Sniffies.

Favorites contain only the profile ID and name you enter. They stay in this browser until removed or the site's browser data is cleared. They do not sync between Chrome and iPhone or change Sniffies' own favorites. No messages are read or sent. Up to 500 bookmarks are supported. A profile removed by its owner may no longer open.

## All comfort-level filters

Version 1.2.0 replaces the original No PNP checkbox with all seven **My Comfort Levels** options: **No Alcohol, No Cannabis, No Tobacco, No Poppers, No PNP, No Other Drugs, and Let’s Discuss**.

Each option has three choices:

- **Any:** do not filter on this option.
- **Does appear:** show profiles with this option selected in My Comfort Levels.
- **Does not appear:** show profiles without this option selected in My Comfort Levels.

Every selected rule must match. For example, **No PNP → Does not appear** plus **No Poppers → Does appear** keeps profiles that omit No PNP and include No Poppers. Tap **Apply filters** to save.

If the original No PNP checkbox was enabled, it becomes **No PNP → Does not appear**. If it was disabled, all comfort choices start at Any. Other filters and your button position are retained. Reset restores No PNP → Does not appear, with every other comfort option set to Any.

A confirmed empty comfort list means no options appear. Unavailable or unreadable comfort details are treated as missing, not proof that an option does not appear; your existing missing-details setting controls those profiles.

## Move the button

Version 1.1.2 lets you drag the floating **Filters** button with a finger or mouse. Release it where you want it. Its position is saved in the current browser and restored on reload. A normal tap still opens the settings; dragging does not open or close them.

The button stays within the visible screen as its size or orientation changes. The settings panel opens above or below it, with scrolling when space is limited. In settings, tap **Reset button position** to return it to the original lower-right location. This leaves your profile filters unchanged. With the button focused, **Alt + arrow keys** also move it.

For current Safari release installation and migration, see [Safari distribution instructions](docs/DISTRIBUTION.md). See the update instructions below for Chrome.

## Map filtering update

Version 1.1.1 removes the blocking “outside your filters” notice. It hides each matching pin's complete marker and tappable area, and also supports the photo cards in the map carousel. Your existing filter preferences are retained.

It also reads the map profile list when Sniffies decodes its startup/search data. This provides another way to receive the list if Safari starts the script after the app has retained its original request method, and handles large startup lists without making a second full response copy. It makes no extra profile requests.

**The reported iPhone failure is not yet confirmed fixed on a real device.** Local tests reproduce missed request capture and verify that supplied map data hides pins before any profile opens. We still need to confirm that your Safari session exposes the same profile data. Profiles with unavailable details follow your missing-details setting; keeping them visible remains the default. Switching to “hide” may hide most or all profiles when data is unavailable, so that is not a substitute for verifying the repair.

After updating, open **Filters → Filter status · v1.4.0** near the bottom of the panel. If pins remain visible, copy the counts shown there. No profile names, IDs, messages, or location are included. If you still see the old alert, the previous script is still running: keep one file, open the Userscripts menu, and reload the Sniffies tab.

## Controls

Tap **Filters** near the bottom right of Sniffies. Choose your preferences and tap **Apply filters**.

- **Age:** minimum and maximum years.
- **Height, weight, endowment:** minimum and maximum values, with imperial or metric units.
- **Body type:** select any combination of Slim, Fit / athletic, Muscular, Average, Stocky, Chubby, and Large.
- **Position:** select any combination of Side, Submissive bottom, Bottom, Power bottom, Vers bottom, Vers, Vers top, Passive top, Top, and Dom top.
- **Activity:** Any time, Online now, Online within 10 minutes, Online within 30 minutes, or Online within the last hour. The recent windows also include people currently online.
- **My Comfort Levels:** each of the seven options supports Any, Does appear, or Does not appear.
- **Missing details:** keep profiles visible, or hide them until all details required by your filters are known.

Leave a range endpoint blank for no limit. Select no body types or positions to allow all. A profile must meet every filter you set; multiple selections within one category mean “any of these.” Ranges include both endpoints and use the site's posted values and rounding.

With imperial units, enter height as `5'9"` or total inches such as `69`. Weight uses pounds and endowment uses inches. Switching units converts your entered ranges. Invalid or reversed ranges show an error without changing the saved filters.

**Pause** restores profiles immediately. **Reset**, followed by **Apply filters**, clears the new filters and restores the original No PNP rule.

## Update an existing installation

**Chrome:** Replace the contents of your previously installed extension folder with the contents of this package's **chrome** folder. Open `chrome://extensions`, find **Lens — Sniffies Comfort Filter**, click its reload button, and then reload Sniffies.

**Safari / iPhone:** Follow [Safari installation, one-time migration, manual updates and rollback](docs/DISTRIBUTION.md). Version 1.5.1 prepares repository distribution; release publication and actual-device verification remain pending. Future approved updates use Userscripts **Check Updates → Update**, without repeated file copying.

Your previous on/off setting and saved filters are retained in the same browser. The old No PNP setting is migrated as described above.

## First-time installation: iPhone Safari

See [the current Safari installation guide](docs/DISTRIBUTION.md). Use the approved generated `dist/sniffies.user.js` release, not the development source or Chrome package.

## First-time installation: desktop Chrome

1. Unzip the package into a permanent folder.
2. Enter `chrome://extensions` in Chrome's address bar.
3. Turn on **Developer mode**, click **Load unpacked**, and select the **chrome** folder containing `manifest.json`.
4. Reload Sniffies.

See [Google's installation instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## First-time installation: Mac Safari

See [the current Safari installation guide](docs/DISTRIBUTION.md), including the native remote-install and manual update workflow.

## Coverage and privacy

The filter uses profile information and connection updates that Sniffies already delivers to your browser. Some details may only become available after opening a profile. **Fully checked** means all fields needed for your current filters are known; the adjacent count shows profiles with missing required details. The missing-details choice controls their visibility. Known mismatches are hidden from supported map pins and carousel cards while filters are on. Opened profiles are left usable without a blocking overlay; any readable fields update the map filter.

“Online now” follows Sniffies' last observed connection/disconnection state; it cannot guarantee someone is currently looking at their screen. Recent activity is checked locally about every 15 seconds while the page is visible. A lost connection makes current online status unknown until another status update arrives. The filter sends no polling requests.

Your filter preferences, button position, and explicitly saved favorites are saved in local browser storage. Required profile stats and activity times stay in the current tab's memory, expire after two hours without another observation of that field, and reset on reload. The extension uploads nothing, fetches no additional profiles, and does not change your Sniffies account.

The visible-page fallback uses English labels; the network field checks use the site's stored values. Sniffies may change its page or response formats.

## Verification status

The filter's logic, browser behavior with synthetic profiles, and phone-size layout were tested. Installation in your browser, a signed-in Sniffies session, and physical iPhone/Safari testing remain pending. See **TEST-RESULTS.md**.

To remove the filter, remove the Chrome extension or delete its `.user.js` file from Userscripts, then reload open Sniffies tabs.
