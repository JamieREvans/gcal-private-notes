# Event Notes for Google Calendar

Private notes on your Google Calendar events, stored in your browser and never shared with guests. A Manifest V3 extension for Chrome and Brave, built with [WXT](https://wxt.dev), Preact and TypeScript.

## Develop

```bash
npm install
npm run dev        # builds to .output/chrome-mv3-dev and watches for changes
npm test           # unit tests (Vitest + happy-dom + WXT fake browser)
npm run typecheck
npm run build      # production build in .output/chrome-mv3
npm run zip        # store upload zip
```

**Load unpacked:**
- **Chrome:** go to `chrome://extensions`, turn on Developer mode, click Load unpacked and choose `.output/chrome-mv3` (or `-dev`).
- **Brave:** go to `brave://extensions` and do the same.

Dev builds show a **Simulate Pro** toggle at the bottom of Settings.

## Layout

| Path | What |
| --- | --- |
| `entrypoints/calendar.content/` | Content script: injects the notes box into the event popup and the full event page, and adds dots to grid chips |
| `entrypoints/sidepanel/` | Side panel: the current event's note, plus all notes with search (Pro) |
| `entrypoints/options/` | Settings: surfaces, sync, templates, export/import, Pro |
| `entrypoints/background.ts` | ExtensionPay, side panel behaviour, sync mirror |
| `lib/gcal-dom.ts` | **Every Google Calendar selector.** Start here when Calendar changes its markup |
| `lib/event-id.ts` | Decodes Calendar's `eid` into calendar, event, series and occurrence |
| `lib/notes-store.ts` | Notes in `chrome.storage.local` (the source of truth) |
| `lib/sync-mirror.ts` | Optional mirror into `chrome.storage.sync` that evicts the oldest from sync only |
| `lib/plan.ts`, `lib/license.ts` | Free limit (5 unlocked notes; older ones are locked, never deleted) and Pro status |

## When Google Calendar changes

If the notes box or the dots stop appearing, inspect the page and update `lib/gcal-dom.ts`. Then update the synthetic skeletons in `test/fixtures/` to match. Never put real calendar data in fixtures.

See `docs/publishing.md` for the Chrome Web Store and ExtensionPay setup, and `docs/testing.md` for the manual test pass.
