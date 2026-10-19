# Roadmap: improvements and marketing

_Drafted 19 October 2026, after the pre-launch audit._

**Positioning:** a sticky note for every calendar event. Zero setup, no accounts, private by design. Most competitors (Fellow, Notion Calendar, meeting-notes apps) need sign-ups, shared docs or a new tool. We live inside the calendar people already use, and nothing leaves their browser.

**Best-fit audiences:**
- People managers who run recurring 1:1s. The series history is the hook.
- Interviewers and recruiters.
- Consultants and freelancers with client calls.
- Anyone who has tried, and given up on, keeping a meeting doc per event.

---

## Already fixed from the audit (before first upload)
- Deleted notes could come back when sync was on. Deletes are now recorded durably, tombstones carry the real delete time, and pushes are batched.
- Sync could keep writing after being switched off. Turning sync off no longer wipes other devices' mirror; there's an explicit "Remove my notes from browser sync" button.
- Imports are validated. Links must point to `calendar.google.com`. Free users are told when an import locks notes.
- The privacy policy and store disclosures now cover the buyer email and the event IDs read for dots. "Stored only in your browser" is fixed for Pro sync, and the Brave sync caveat is in the listing.
- Locked notes can be deleted individually.
- Accessibility: save status is announced to screen readers, the search box has a label, and the disabled Pro sections are inert.

## Remaining audit items (small)
- **Performance with hundreds of notes:** every save makes every open view re-read all storage. Keep an in-memory index updated from `storage.onChanged`.
- **"Last opened event" in the side panel** is shared across windows. Track it per window via `sender.tab.windowId`.
- **Locked dots** are shown only by fading. Add a tiny lock glyph, or a different shape.

---

## Product improvements, by value ÷ effort

### Now (first month after launch)
1. **Welcome page on install.** A 3-step "click an event → type → done" tab opened from `runtime.onInstalled`. Most extension users who never see the value in the first minute uninstall, so this is the cheapest activation win.
2. **Polite review prompt.** After the 3rd note, show one dismissible line in the header: "Finding this useful? A review helps a hobby dev." Shown once, never again. Reviews drive store ranking more than anything else.
3. **Keyboard shortcut** (`commands` API, no new permission warning). Focus the notes box in the open popup, or open the side panel.
4. **Clickable links and checklists in notes.** Render URLs and `- [ ]` items when the note isn't focused. Small, but makes notes feel alive.

### Next (Pro value, gives people a reason to upgrade)
5. **Follow-ups view (Pro).** Collect every unchecked `- [ ]` across all notes into one list in the side panel, grouped by meeting and linked back. For managers this alone justifies $1.
6. **Series pinned note (Pro).** One standing note per recurring series (e.g. "Sam: career goals, ongoing topics") shown above each occurrence's note.
7. **Prep for today (Pro).** A side panel section listing today's visible events that have earlier notes ("3 meetings today have history"). Read it from the grid chips already on screen, with no Calendar API or OAuth.
8. **Send to my notes app (Pro).** One-click "Open in Obsidian" (`obsidian://new` URI), plus Markdown copy with front matter (title, date, attendees) for Notion and Logseq. This leans into the "no structure for each event" pain point.

### Later
9. **Person view.** Read the guest list from the popup and let users see everything they've noted in meetings with a given person. Very compelling, but it stores attendee names, so update the privacy policy and disclosures first.
10. **Optional passphrase encryption (Pro).** Encrypt notes at rest with Web Crypto. A strong differentiator for interviewers and anyone handling sensitive feedback.
11. **Firefox and Edge.** WXT builds both (`wxt build -b firefox`), and ExtensionPay supports Firefox. Edge Add-ons and Firefox AMO are free to list and add audience with no extra code paths.
12. **Localisation.** Use `_locales` for UI strings, then localised store listings (es, de, fr, pt-BR, ja). Each translated listing ranks in that language's store search.

---

## Marketing

### Launch week
- **Seed reviews.** Use ExtensionPay's free-users option to give Pro to 10–20 early users (friends, colleagues, beta testers) in exchange for honest reviews. Ten real reviews in the first weeks matter more than any ad.
- **Store search basics.** Keep "Google Calendar" in the name. Work in "meeting notes", "1:1 notes", "private notes" and "calendar notes" naturally in the summary and the first lines of the description. Choose the Productivity category.
- **Demo video.** A 30–45 second screen recording: click event → type → reopen next week → history. Upload to YouTube and add it to the store listing (it shows as the first media item). Reuse a GIF version in the README and social posts.
- **Show HN.** Pitch it as an open-source (AGPL), local-first, no-account Chrome extension. The privacy story and the "$1 coffee" model both go down well there. Post Tuesday–Thursday morning US time.
- **Product Hunt.** A light launch. The tagline is "A private sticky note on every Google Calendar event". Reuse the screenshots and promo tile.

### Ongoing, low effort
- **Communities.** Before posting, read each one's self-promotion rules; many allow it only in weekly threads.
  - r/productivity, r/chrome_extensions, r/EngineeringManagers, r/managers (the 1:1 angle).
  - r/recruiting, for interview notes.
  - Indie Hackers, where the "$1 hobby extension" story is a natural post.
- **One useful article.** For example, "How I keep 1:1 notes without a doc per meeting". Post it on your blog, dev.to, LinkedIn and Medium. Lead with the workflow and mention the extension last.
- **Directories:** AlternativeTo (list it as an alternative to Fellow and Notion meeting notes), SaaSHub, Chrome-extension roundups, and awesome-lists on GitHub.
- **GitHub.** Add a README GIF, set the topics (`chrome-extension`, `google-calendar`, `privacy`, `local-first`) and pin the repo. An open-source repo is itself a trust signal for a notes tool.
- **LinkedIn / X / Bluesky.** A short "I built this because…" post with the GIF. Managers on LinkedIn are the core audience.

### Pricing experiments (later, once there's traffic)
- Keep $1 as the floor. The $3 and $5 coffee sizes let fans give more.
- Consider a "team coffee" plan ($10 for 5 activations) if managers ask to share it with their team.
- Watch ExtensionPay's dashboard for the free-to-paid conversion rate. If it's very low, try 10 free notes instead of 5 before adding more prompts.
