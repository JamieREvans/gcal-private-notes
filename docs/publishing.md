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

## 3. Store listing (copy to paste)

**Name:** Private Event Notes for Google Calendar

**Summary (≤132 chars):**
Private notes on your Google Calendar events. Stored in your browser, never shared with guests. No setup, no extra docs.

**Description:**

> Keep private notes on any Google Calendar event without creating a page for every meeting in your notes app.
>
> Click an event and a small "Private Event Notes · Only visible to you" box appears right in the event card. Type, and it's saved. Open the event again next week and your note is there.
>
> • Private by design: notes are stored in your browser. They're never added to the event or shared with guests or organisers, and they're never sent to the developer.
> • Works where you already are: in the event popup, the full event page and the browser side panel. Events with notes get a small dot.
> • Made for recurring meetings: each occurrence gets its own note.
> • Your data is yours: export everything to JSON at any time.
>
> Free: up to 5 notes (older notes are kept and unlock when you upgrade, never deleted).
>
> Pro is a one-off "buy me a coffee" from $1 that supports an independent hobby developer:
> • Unlimited notes
> • Sync across your Chrome browsers (Brave's sync may not include extension data)
> • History from earlier occurrences of recurring meetings (great for 1:1s)
> • Search every note in the side panel
> • Note templates
> • Export to Markdown for Obsidian, Notion, Logseq and other notes apps
>
> Not affiliated with or endorsed by Google. "Google Calendar" is a trademark of Google LLC.

**Category:** Productivity · **Language:** English

**Graphics** (all in `store/`, regenerate with `npm run build && npm run e2e -- --screenshots && npm run store-assets`):
- Icon: `public/icon/128.png`
- Screenshots (1280×800): `store/screenshot-1-popup.png`, `store/screenshot-2-sidepanel.png`, `store/screenshot-3-settings.png`. These show the real extension UI over a mock calendar with made-up data. A shot taken in real Google Calendar (on a demo calendar with no real names) would make a stronger first screenshot later.
- Small promo tile (440×280): `store/promo-small-440x280.png`

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

## 5. Submit

- [ ] Upload the zip, fill in the listing and set **Visibility: Unlisted** for the first release. Install it from the store link in both Chrome and Brave. Run through `docs/testing.md` and make one real $1 purchase.
- [ ] Switch to **Public**. Review usually takes a few days and can take longer for extensions with host permissions.
- [ ] For updates, bump the version, run `npm run zip`, upload on the Package tab and submit.
