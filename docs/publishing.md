# Publishing checklist (Chrome Web Store + ExtensionPay)

Brave installs extensions straight from the Chrome Web Store, so one listing covers Chrome and Brave.

## 1. Accounts (do these now; they don't depend on the code)

- [ ] **Choose the publishing Google account.** Its name, and optionally its email, appear on the listing. Turn on 2-Step Verification, which the store requires.
- [ ] **Register as a Chrome Web Store developer** at <https://chrome.google.com/webstore/devconsole>. Pay the one-time registration fee (US$5 at the time of writing) and accept the developer agreement.
- [ ] **Account tab:** set the publisher display name, verify the contact email and complete the **trader / non-trader declaration**. Taking payments for Pro arguably makes you a *trader* under the EU Digital Services Act. A trader's address and phone number are shown to EU users, so read the help text before choosing.
- [ ] **ExtensionPay:** sign up at <https://extensionpay.com>, register the extension and connect a Stripe account. Stripe will ask for identity and bank details.
  - Create three **one-time** plans: **$1 / $3 / $5** (for example nicknamed `coffee-small`, `coffee`, `coffee-large`). Every plan unlocks the same Pro. Calling `openPaymentPage()` with no plan shows all three, which gives "pay what you want, $1 minimum".
  - Turn on login, so buyers can restore Pro in other browsers.
  - [x] ExtensionPay id `private-notes-for-google-calendar` is set in `lib/license.ts`.
  - Test with Stripe test cards in test mode before going live.
- [x] **Public repo:** <https://github.com/JamieREvans/gcal-private-notes>, licensed AGPL-3.0 (the same licence as the bundled `extpay` library). The privacy policy URL for the store is <https://github.com/JamieREvans/gcal-private-notes/blob/main/PRIVACY.md>.

## 2. Build the package

```bash
npm run icons     # only if assets/icon.svg changed
npm test
npm run zip       # → dist/gcal-notes-<version>-chrome.zip
```

Bump `version` in `package.json` for every upload.

## 3. Store listing tab

**Summary:** comes from the manifest, so there's nothing to type:
> Private notes on your Google Calendar events. Never added to the event or shared with guests.

**Description** (paste as-is; the store shows plain text, so bullets are "•"):

```
Keep private notes on any Google Calendar event, without creating a doc for every meeting.

Click an event and a small "Private Event Notes" box appears right in the event card. Type, and it's saved. Open the event again next week and your note is still there.

WHY PEOPLE USE IT
• 1:1s that build on each other: recurring meetings show your notes from earlier occurrences
• Interview and client-call notes that stay out of shared calendars
• No setup: no account, no new app, no structure to maintain

PRIVATE BY DESIGN
• Notes are stored in your browser, and never added to the event or shared with guests or organisers
• Nothing is sent to the developer. No analytics, no tracking
• Open source (AGPL-3.0): https://github.com/JamieREvans/gcal-private-notes

WHERE YOUR NOTES APPEAR
• In the event popup and on the full event page
• As a subtle dot on events that have notes
• In the browser side panel
Each can be turned on or off in Settings.

FREE
• Up to 5 notes. Older notes are kept safely and unlock when you upgrade, never deleted
• Export everything to JSON at any time

PRO: A ONE-OFF "BUY ME A COFFEE" FROM $1
Pick any coffee size and you get everything, forever. It supports an independent hobby developer.
• Unlimited notes
• Rich text: headings, bold, italics, bullet and numbered lists, checklists and links, with a simple toolbar
• Today: your day's recurring meetings, each with last time's notes, ready in the side panel
• Follow-ups: every open "- [ ]" item across all your notes in one list. Tick them off there
• A pinned note for each recurring meeting (goals, ongoing topics), plus history from earlier occurrences
• Search every note in the side panel
• Note templates (1:1, meeting, interview)
• Export to Markdown for Obsidian, Notion, Logseq and other notes apps
• Sync between browsers signed in to the same Chrome profile (Brave's sync may not include extension data)

Not affiliated with or endorsed by Google. Google Calendar is a trademark of Google LLC.
```

**Category:** Productivity → **Workflow & Planning**. If that sub-category isn't offered, pick **Tools**.
**Language:** English.

**Graphics** (all in `store/`; regenerate with `npm run build && npm run e2e -- --screenshots && npm run demo-video && npm run store-assets`):

| Field | File |
| --- | --- |
| Store icon (128×128) | `public/icon/128.png` |
| Screenshots (1280×800; up to 5, in this order) | `store/screenshot-1-notes.png`, `-2-private.png`, `-3-today.png`, `-4-followups.png`, `-5-pro.png` |
| Same screenshots at 640×400, if preferred | `store/640x400/` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `store/promo-marquee-1400x560.png` |
| Global promo video (YouTube URL) | Upload `store/demo-video.webm` to YouTube (Unlisted is fine) and paste the link |

The screenshots and video show the real extension running on an illustrative calendar page with made-up data.

**Additional fields:**
- Official URL: leave as None. It needs a domain verified in Google Search Console.
- Homepage URL: `https://github.com/JamieREvans/gcal-private-notes`
- Support URL: `https://github.com/JamieREvans/gcal-private-notes/issues`
- Mature content: No.

## 4. Privacy practices tab

**Single purpose:**
Lets users write private notes attached to their Google Calendar events and view them alongside those events.

**Permission justifications:**
- `storage`: saves the user's notes, settings and templates locally in the browser.
- `unlimitedStorage`: lets users keep many notes without hitting the default local storage quota.
- `sidePanel`: shows the user's notes, search and the current event's note in the browser side panel.
- Host access `https://calendar.google.com/*` (content script): reads the opened event's identifier, title and time to attach the note, and shows the notes box and markers on the calendar page.
- Host access `https://extensionpay.com/*` (content script): confirms a completed Pro purchase on ExtensionPay's payment page so Pro unlocks immediately.

**Remote code:** No.

**Data usage:** tick these categories, and only these:
- **Personally identifiable information:** the buyer's email address, collected by ExtensionPay at purchase and visible to you in their dashboard.
- **Financial and payment information:** payments are processed by ExtensionPay and Stripe. The extension never sees card details.

Leave the rest unticked:
- Notes, the event titles and times saved with them, and the event IDs read for dots are processed and stored locally. They are never sent to you or any server you control, so they aren't "collected" in the store's sense.
- Optional browser sync stores notes in the user's own Chrome Sync, not on your servers.

Then tick all three certifications: you don't sell user data, you don't use it for purposes unrelated to the single purpose, and you don't use it for creditworthiness.

**Privacy policy URL:** <https://github.com/JamieREvans/gcal-private-notes/blob/main/PRIVACY.md>

## 5. Distribution tab

- **Payments:** tick **Contains in-app purchases**, because Pro is bought through ExtensionPay.
- **Visibility:** **Unlisted** for the first release, then **Public**.
- **Regions:** all regions.

## 6. Submit

- [ ] Upload the zip, fill in the listing and set **Visibility: Unlisted** for the first release. Install it from the store link in both Chrome and Brave. Run through `docs/testing.md` and make one real $1 purchase.
- [ ] Switch to **Public**. Review usually takes a few days and can take longer for extensions with host permissions.
- [ ] For updates, bump the version, run `npm run zip`, upload on the Package tab and submit.
