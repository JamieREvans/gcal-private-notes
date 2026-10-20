// End-to-end check: loads the built extension into Playwright's Chromium and
// drives it against a mock Google Calendar (test/e2e/mock-calendar.html).
// Usage: npm run build && npm run e2e   (add --screenshots to write store shots)
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const EXT = resolve('dist/chrome-mv3');
const MOCK = await readFile(resolve('test/e2e/mock-calendar.html'), 'utf8');
const EVENT_PAGE = await readFile(resolve('test/fixtures/event-page.html'), 'utf8');
const SHOTS = process.argv.includes('--screenshots');
const results = [];
if (SHOTS) await mkdir('store/screenshots', { recursive: true });

async function step(name, fn) {
  try {
    await fn();
    results.push(['ok', name]);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push(['fail', name]);
    console.log(`  ✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}

const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'pen-e2e-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Never reach the real ExtensionPay: it would register test installs on the live account.
    '--host-resolver-rules=MAP extensionpay.com 127.0.0.1, MAP *.extensionpay.com 127.0.0.1',
  ],
});

const errors = [];
context.on('weberror', (e) => errors.push(String(e.error())));

// Google Calendar's real policy (captured Oct 2026), so the extension is tested under
// Trusted Types and a strict nonce-based script policy, like on the real page.
const CALENDAR_CSP =
  "require-trusted-types-for 'script'; script-src 'report-sample' 'nonce-e2e' 'unsafe-inline' 'strict-dynamic' https: http: 'unsafe-eval'; object-src 'none'; base-uri 'self'";
await context.route('https://calendar.google.com/**', (route) => {
  const isEventPage = /\/r\/eventedit\//.test(new URL(route.request().url()).pathname);
  route.fulfill({
    contentType: 'text/html',
    headers: { 'content-security-policy': CALENDAR_CSP },
    body: isEventPage ? EVENT_PAGE : MOCK,
  });
});

let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker');
const extId = new URL(worker.url()).host;
const storage = (area = 'local') => worker.evaluate((a) => chrome.storage[a].get(null), area);
const setStorage = (items) => worker.evaluate((i) => chrome.storage.local.set(i), items);
const clearNotes = () =>
  worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('note:')));
  });

const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const notesBox = page.locator('[role=dialog] event-notes');
// innerText on a shadow host doesn't include its shadow tree, so read the tree directly.
const shadowText = (selector = '[role=dialog] event-notes') =>
  page.evaluate((sel) => document.querySelector(sel)?.shadowRoot?.querySelector('div')?.innerText ?? '', selector);
const boxText = async () => {
  await notesBox.locator('.en-box').waitFor();
  await page.waitForTimeout(150); // let plan state load
  return shadowText();
};
// Runs fn(shadowRoot) inside the popup's notes box.
const shadowEval = (fn, selector = '[role=dialog] event-notes') =>
  page.evaluate(([src, sel]) => new Function('root', `return (${src})(root)`)(document.querySelector(sel).shadowRoot), [fn.toString(), selector]);
const waitForFocus = (inner, selector = '[role=dialog] event-notes') =>
  page.waitForFunction(([sel, inn]) => document.querySelector(sel)?.shadowRoot?.activeElement?.closest(inn), [selector, inner], { timeout: 5000 });
// The note field is ready: a plain textarea (free) or the rich editor (Pro).
const ready = (box) => box.locator('textarea:not([disabled]), .en-rich-content').first().waitFor({ timeout: 5000 });

console.log(`Extension ${extId}`);

await step('popup shows the branded notes box', async () => {
  await page.goto('https://calendar.google.com/calendar/u/0/r/week');
  await page.getByText('Quarterly planning').click();
  await notesBox.waitFor({ timeout: 5000 });
  const text = await boxText();
  assert.match(text, /Private Event Notes/);
  assert.match(text, /Only visible to you/);
});

await step('typing saves the note with an event snapshot, and keys never reach Calendar', async () => {
  await page.evaluate(() => (window.__keys = []));
  await notesBox.locator('textarea').click();
  await page.keyboard.type('Agenda: budget, hiring. e c ? j k');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(800);
  const all = await storage();
  const note = Object.values(all).find((v) => v?.eventId === 'planning42');
  assert.ok(note, 'note saved');
  assert.equal(note.text, 'Agenda: budget, hiring. e c ? j ');
  assert.equal(note.title, 'Quarterly planning');
  assert.equal(note.calendarId, 'alex@example.com');
  assert.deepEqual(await page.evaluate(() => window.__keys), [], 'page saw no keystrokes');
});

await step('ⓘ popover explains privacy and closes with Escape (popup stays open)', async () => {
  await notesBox.getByRole('button', { name: 'About these notes' }).click();
  assert.match(await boxText(), /isn't part of Google Calendar/);
  await page.keyboard.press('Escape');
  assert.doesNotMatch(await boxText(), /isn't part of Google Calendar/);
  assert.equal(await page.locator('[role=dialog]').count(), 1);
});

await step('Escape in the textarea still closes the Calendar popup', async () => {
  await notesBox.locator('textarea').click();
  await page.keyboard.press('Escape');
  await page.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 2000 });
});

await step('chip with a note gets a dot marker', async () => {
  const dot = page.locator('[data-eventchip]', { hasText: 'Quarterly planning' }).locator('.event-notes-marker');
  await dot.waitFor({ timeout: 3000 });
  assert.equal(await page.locator('.event-notes-marker').count(), 1);
});

await step('reopening the popup shows the saved note', async () => {
  await page.getByText('Quarterly planning').click();
  await ready(notesBox);
  assert.equal(await notesBox.locator('textarea').first().inputValue(), 'Agenda: budget, hiring. e c ? j ');
  await page.keyboard.press('Escape');
});

await step('full event page shows the same note above the description', async () => {
  await page.goto('https://calendar.google.com/calendar/u/0/r/eventedit/cGxhbm5pbmc0MiBhbGV4QGV4YW1wbGUuY29t');
  const box = page.locator('event-notes');
  await box.waitFor({ timeout: 5000 });
  await ready(box);
  assert.equal(await box.locator('textarea').inputValue(), 'Agenda: budget, hiring. e c ? j ');
  assert.ok(await page.evaluate(() => document.querySelector('event-notes').nextElementSibling?.id === 'xDesc'));
});

await step('free plan: 6th note shows the lock warning naming the oldest note', async () => {
  await clearNotes();
  const base = { calendarId: 'other@example.com', text: 'old', createdAt: 1 };
  const seed = {};
  for (let i = 0; i < 5; i++) {
    const key = `other@example.com|seed${i}`;
    seed[`note:${key}`] = { ...base, key, eventId: `seed${i}`, seriesId: `seed${i}`, title: `Seed ${i}`, updatedAt: 100 + i };
  }
  await setStorage(seed);
  await page.goto('https://calendar.google.com/calendar/u/0/r/week');
  await page.getByText('Dentist').click();
  await notesBox.locator('textarea').click();
  const text = await boxText();
  assert.match(text, /lock your note on Seed 0/);
  assert.match(text, /from \$1/);
  await page.keyboard.type('Ask about whitening');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.getByText('Dentist').click();
  assert.doesNotMatch(await boxText(), /lock your note/);
  await page.keyboard.press('Escape');
});

await step('locked note is hidden behind an upgrade notice', async () => {
  // Seed 0 is now the 6th most recent → locked. Give the mock chip its id.
  await page.evaluate(() => {
    const chip = document.querySelector('[data-eventchip]');
    chip.dataset.eventid = btoa('seed0 other@example.com').replace(/=+$/, '');
    chip.dataset.title = 'Seed 0';
  });
  await page.locator('[data-eventchip]').first().click();
  await notesBox.waitFor();
  assert.match(await boxText(), /This note is locked/);
  assert.equal(await notesBox.locator('textarea').count(), 0);
  await page.keyboard.press('Escape');
});

await step('recurring series: free sees a Pro teaser, Pro sees history', async () => {
  await clearNotes();
  const mk = (id, text, start) => ({
    key: `alex@example.com|${id}`,
    calendarId: 'alex@example.com',
    eventId: id,
    seriesId: 'weekly1on1',
    instanceStart: start,
    title: 'Weekly 1:1 with Sam',
    text,
    createdAt: 1,
    updatedAt: 2,
  });
  await setStorage({ 'note:alex@example.com|weekly1on1_20261012T130000Z': mk('weekly1on1_20261012T130000Z', 'Sam wants to lead the Q4 launch', '2026-10-12T13:00:00Z') });
  await page.reload();
  await page.getByText('Weekly 1:1 with Sam').first().click();
  await notesBox.waitFor();
  assert.match(await boxText(), /1 note from other occurrences of this event\s*Pro/);
  await page.keyboard.press('Escape');

  await setStorage({ license: { paid: false, checkedAt: 0, devOverride: true } });
  await page.getByText('Weekly 1:1 with Sam').first().click();
  await notesBox.waitFor();
  const text = await boxText();
  if (/Notes from 1 other occurrence/.test(text)) return; // dev build: simulate Pro works
  // Production build ignores devOverride, so grant Pro directly.
  await page.keyboard.press('Escape');
  await setStorage({ license: { paid: true, checkedAt: Date.now() } });
  await page.getByText('Weekly 1:1 with Sam').first().click();
  await notesBox.waitFor();
  assert.match(await boxText(), /Notes from 1 other occurrence/);
  assert.match(await boxText(), /Start from:/);
});

await step('Pro: pin a note to every occurrence of a recurring meeting', async () => {
  await setStorage({ license: { paid: true, checkedAt: Date.now() } });
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByText('Weekly 1:1 with Sam').first().click();
  await ready(notesBox);
  await notesBox.getByRole('button', { name: /Pin a note to every occurrence/ }).click();
  await waitForFocus('.en-pinned-text .en-rich-content');
  await page.keyboard.type('Goals: promo case by Q1');
  await page.waitForTimeout(800);
  const pinned = (await storage())['note:alex@example.com|weekly1on1|series'];
  assert.equal(pinned?.kind, 'series');
  assert.equal(pinned?.text, 'Goals: promo case by Q1');
  // It shows on the other occurrence too.
  await page.keyboard.press('Escape');
  await page.getByText('Weekly 1:1 with Sam').nth(1).click();
  await ready(notesBox);
  await notesBox.locator('.en-pinned-text .en-rich-content').waitFor();
  assert.equal(await shadowEval((root) => root.querySelector('.en-pinned-text .en-rich-content').innerText.trim()), 'Goals: promo case by Q1');
  await page.keyboard.press('Escape');
});

await step('Pro: rich text toolbar formats text and saves Markdown (under Calendar\'s Trusted Types policy)', async () => {
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByText('Quarterly planning').click();
  const content = notesBox.locator('.en-rich-content').first();
  await content.waitFor({ timeout: 5000 });
  await page.evaluate(() => (window.__keys = []));
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await notesBox.getByRole('button', { name: 'Large heading' }).click();
  await page.keyboard.type('Budget');
  await page.keyboard.press('Enter');
  await notesBox.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('Decision:');
  await notesBox.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type(' hire two');
  await page.keyboard.press('Enter');
  await notesBox.getByRole('button', { name: 'Bulleted list' }).click();
  await page.keyboard.type('first point');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leave the list
  await notesBox.getByRole('button', { name: /Checklist/ }).click();
  await page.keyboard.type('Send budget to finance');
  await page.waitForTimeout(800);
  const saved = (await storage())['note:alex@example.com|planning42'];
  assert.equal(saved.text, '# Budget\n\n**Decision:** hire two\n\n- first point\n\n- [ ] Send budget to finance');
  assert.deepEqual(await page.evaluate(() => window.__keys), [], 'page saw no keystrokes');
});

await step('Pro: pasting rich HTML works under Trusted Types and keeps only safe formatting', async () => {
  const content = notesBox.locator('.en-rich-content').first();
  await content.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const target = document.querySelector('[role=dialog] event-notes').shadowRoot.querySelector('.en-rich-content');
    const data = new DataTransfer();
    data.setData('text/html', '<p>From <b>Docs</b> <img src=x onerror="window.__pwned=1"> <a href="javascript:alert(1)">bad</a> <a href="https://ok.example/">good</a></p>');
    data.setData('text/plain', 'From Docs bad good');
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(800);
  const saved = (await storage())['note:alex@example.com|planning42'].text;
  assert.match(saved, /From \*\*Docs\*\*/);
  assert.match(saved, /\[good\]\(https:\/\/ok\.example\/?\)/);
  assert.doesNotMatch(saved, /javascript:|onerror/);
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  await page.keyboard.press('Escape');
});

await step('Pro: Today lists the meeting with last time\'s note; Follow-ups ticks items off', async () => {
  // Make the first 1:1 chip an occurrence of today, so "Today" has something to show.
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const stamp = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const todayId = `weekly1on1_${stamp}`;
  await page.evaluate((id) => {
    document.querySelector('[data-eventchip]').dataset.eventid = btoa(`${id} alex@example.com`).replace(/=+$/, '');
    document.body.append(document.createElement('span')); // nudge the observer
  }, todayId);
  await setStorage({
    'note:alex@example.com|weekly1on1_20261012T130000Z': {
      key: 'alex@example.com|weekly1on1_20261012T130000Z', calendarId: 'alex@example.com',
      eventId: 'weekly1on1_20261012T130000Z', seriesId: 'weekly1on1', instanceStart: '2026-10-12T13:00:00Z',
      title: 'Weekly 1:1 with Sam', text: 'Sam wants to lead the Q4 launch\n- [ ] Intro to design lead', createdAt: 1, updatedAt: 3,
    },
  });
  await page.waitForTimeout(400);

  const panel = await context.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.getByRole('tab', { name: /Today \(1\)/ }).waitFor({ timeout: 5000 });
  const today = await panel.locator('[role=tabpanel]').innerText();
  assert.match(today, /Weekly 1:1 with Sam/);
  assert.match(today, /Pinned[\s\S]*Goals: promo case by Q1/);
  assert.match(today, /Last time[\s\S]*Sam wants to lead the Q4 launch/);
  if (SHOTS) await panel.screenshot({ path: 'store/screenshots/raw-today.png' });

  await panel.getByRole('tab', { name: 'Follow-ups' }).click();
  const openCount = async () => Number(/(\d+) open follow-up/.exec(await panel.locator('[role=tabpanel]').innerText())[1]);
  const before = await openCount();
  assert.match(await panel.locator('[role=tabpanel]').innerText(), /Weekly 1:1 with Sam[\s\S]*Intro to design lead/);
  if (SHOTS) await panel.screenshot({ path: 'store/screenshots/raw-followups.png' });
  // Ticked items leave the open list straight away, so click rather than check().
  await panel.getByRole('checkbox', { name: 'Intro to design lead' }).click();
  await panel.waitForTimeout(300);
  const updated = (await storage())['note:alex@example.com|weekly1on1_20261012T130000Z'];
  assert.match(updated.text, /- \[x\] Intro to design lead/);
  assert.equal(await openCount(), before - 1);
  await panel.close();
});

await step('side panel shows the current event and (Pro) searchable notes', async () => {
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  await panel.getByText('Last opened event').waitFor();
  assert.match(await panel.locator('body').innerText(), /Weekly 1:1 with Sam/);
  await panel.getByRole('tab', { name: 'All notes' }).click();
  await panel.getByPlaceholder('Search notes and event titles').fill('Q4');
  assert.match(await panel.locator('body').innerText(), /Sam wants to lead the Q4 launch/);
  if (SHOTS) await panel.screenshot({ path: 'store/screenshots/raw-sidepanel.png' });
  await panel.close();
});

await step('settings page renders, with Pro active and export buttons', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`);
  await options.getByText('Where notes appear').waitFor();
  const text = await options.locator('body').innerText();
  assert.match(text, /Private Event Notes Pro/);
  assert.match(text, /Export \(JSON\)/);
  if (SHOTS) await options.screenshot({ path: 'store/screenshots/raw-settings.png', fullPage: false });
  await options.close();
});

await step('turning off the popup surface removes the box', async () => {
  const settings = (await storage()).settings ?? {};
  await setStorage({ settings: { ...settings, showInPopup: false } });
  await page.waitForTimeout(300);
  assert.equal(await notesBox.count(), 0);
  await setStorage({ settings: { ...settings, showInPopup: true } });
});

if (SHOTS) {
  // Opening Settings asks ExtensionPay for the real status, which (blocked here) resets to free.
  await setStorage({ license: { paid: true, checkedAt: Date.now() } });
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByText('Weekly 1:1 with Sam').first().click();
  await ready(notesBox);
  const content = notesBox.locator('.en-rich-content').first();
  await content.waitFor();
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Sam: shipped the onboarding revamp 🎉\nFollow-ups:\n[ ] Intro to design lead\nRevisit Q4 scope');
  await page.waitForTimeout(600);
  await notesBox.locator('summary').click();
  await page.screenshot({ path: 'store/screenshots/raw-popup.png' });
}

const unexpected = errors.filter((e) => !/extensionpay|ERR_|Failed to fetch|net::/i.test(e));
if (unexpected.length) console.log('\nPage/extension errors:\n  ' + unexpected.join('\n  '));

await context.close();
const failed = results.filter(([s]) => s === 'fail').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed || unexpected.length ? 1 : 0);
