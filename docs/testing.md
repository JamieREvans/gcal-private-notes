# Manual test pass

Run this in **both Chrome and Brave**, using the unpacked build first and then the Unlisted store build.

## Core
- [ ] Click an event. The "Private Event Notes · Only visible to you" box appears in the popup. Type a note, close the popup, reopen it: the note is still there.
- [ ] Click the ⓘ button: the popover explains this is an extension, notes are private and never shared, and shows the free count. Esc closes it, and so does clicking outside.
- [ ] **Keyboard shortcuts:** turn on Calendar's keyboard shortcuts (Settings → Keyboard shortcuts). In the notes box, type `e`, `c`, `?`, `j`/`k`, and press Backspace and Delete. Only the text changes: the event is not edited, created or deleted, and the view doesn't move.
- [ ] Open the event's full page (Edit or "Open details"). The same note appears above the description.
- [ ] The event's chip in the grid shows an amber dot. Check day, week and month views.
- [ ] The note is not in the event's description, and a guest account sees nothing.
- [ ] On a weekly recurring event, write notes on two occurrences.

## Free plan (Settings → Simulate Pro off)
- [ ] With 5 notes, focus an empty note: the banner names the note that will lock and offers "Go unlimited · from $1" and "Not now".
- [ ] After saving the 6th note, the oldest shows "This note is locked" in its popup, and its dot is faded.
- [ ] A recurring event shows "N notes from other occurrences · Pro".
- [ ] The side panel shows the current event's note plus the Pro card. Sync and Markdown export are disabled.
- [ ] JSON export includes the locked notes.

## Pro (Simulate Pro on, then a real test-mode purchase)
- [ ] Locked notes unlock, and series history lists the other occurrences.
- [ ] Side panel: search by text and by title, expand a note, edit it, "Open in Calendar", "Copy as Markdown".
- [ ] Templates appear as chips on an empty note. Edit them in Settings.
- [ ] Export as Markdown produces a readable `.md` file.
- [ ] Sync: enable it on two Chrome profiles signed into the same account and check that a note propagates. Disable it and check that the sync status clears.
- [ ] ExtensionPay: "Buy me a coffee" opens the plan chooser. After paying with a test card, Pro activates without a reload. On another profile, "Restore purchase" unlocks Pro.

## Settings
- [ ] Turning off each surface (popup, full page, dots) removes it straight away.
- [ ] Export, Delete all, then Import restores everything.
