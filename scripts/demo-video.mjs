// Records a ~35s demo of the real extension on an illustrative calendar
// (test/e2e/demo-calendar.html) → store/demo-video.webm.
// Usage: npm run build && npm run demo-video
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const EXT = resolve('dist/chrome-mv3');
const CALENDAR = await readFile(resolve('test/e2e/demo-calendar.html'), 'utf8');
const icon = await readFile(resolve('assets/icon.svg'), 'utf8');
const videoDir = await mkdtemp(join(tmpdir(), 'pen-video-'));
const size = { width: 1280, height: 800 };

const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'pen-demo-')), {
  channel: 'chromium',
  headless: true,
  viewport: size,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--host-resolver-rules=MAP extensionpay.com 127.0.0.1, MAP *.extensionpay.com 127.0.0.1',
  ],
});
await context.route('https://calendar.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: CALENDAR }));

let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker');
const extId = new URL(worker.url()).host;

// Demo data: Pro, plus a few earlier notes.
const DAY = 24 * 60 * 60 * 1000;
const note = (eventId, text, title, instanceStart, daysAgo, when) => {
  const updatedAt = Date.now() - daysAgo * DAY;
  const calendarId = 'alex@example.com';
  const key = `${calendarId}|${eventId}`;
  return [`note:${key}`, { key, calendarId, eventId, seriesId: eventId.replace(/_\d{8}T\d{6}Z$/, ''), instanceStart, title, when, text, createdAt: updatedAt, updatedAt }];
};
await worker.evaluate(
  (items) => chrome.storage.local.set(items),
  Object.fromEntries([
    ['license', { paid: true, checkedAt: Date.now() }],
    note('weekly1on1_20261012T130000Z', 'Sam wants to lead the Q4 launch.\nAsked about the promo timeline.', 'Weekly 1:1 with Sam', '2026-10-12T13:00:00Z', 7),
    note('weekly1on1_20261005T130000Z', 'Back from leave. Onboarding revamp is the priority.', 'Weekly 1:1 with Sam', '2026-10-05T13:00:00Z', 14),
    note('acme5', 'Acme wants the Q4 rollout split into two phases.', 'Client call: Acme', undefined, 2, 'Fri, Oct 16 · 1:00 – 2:00pm'),
    note('interview31', 'Strong systems design. Probe on testing culture.', 'Interview: Senior Engineer', undefined, 3, 'Thu, Oct 15 · 10:00 – 11:00am'),
  ]),
);

const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);
// Saves a still per scene (store/screenshots/demo-N.png); store-assets turns some into store screenshots.
await mkdir('store/screenshots', { recursive: true });
let scene = 0;
const still = () => page.screenshot({ path: `store/screenshots/demo-${++scene}.png` });

async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: '2147483647',
        background: 'rgba(32, 28, 18, 0.92)', color: '#fff', padding: '12px 22px', borderRadius: '999px',
        font: "500 20px 'Helvetica Neue', Arial, sans-serif", boxShadow: '0 6px 24px rgba(0,0,0,.25)',
        transition: 'opacity .25s', whiteSpace: 'nowrap',
      });
      document.body.append(el);
    }
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = t; el.style.opacity = '1'; }, 250);
  }, text);
  await wait(400);
}

const box = page.locator('[role=dialog] event-notes');

// 1. Calendar
await page.goto('https://calendar.google.com/calendar/u/0/r/week');
// The install-time ExtensionPay check (blocked here) resets the licence to free; restore Pro for the demo.
await wait(500);
await worker.evaluate(() => chrome.storage.local.set({ license: { paid: true, checkedAt: Date.now() } }));
await wait(800);
await caption('Private notes on every Google Calendar event');
await still();
await wait(2200);

// 2. Open the 1:1 and write
await page.getByText('Weekly 1:1 with Sam').click();
await box.locator('.en-rich-content').waitFor();
await caption('Click an event. Your private note is right there.');
await wait(1800);
await box.locator('.en-rich-content').click();
await caption('Just type. It saves as you go.');
await page.keyboard.type('Sam shipped the onboarding revamp 🎉', { delay: 38 });
await page.keyboard.press('Enter');
await caption('Format with a click: headings, bold, lists, checklists');
await box.getByRole('button', { name: 'Bold' }).click();
await page.keyboard.type('Follow-ups', { delay: 38 });
await box.getByRole('button', { name: 'Bold' }).click();
await page.keyboard.press('Enter');
await box.getByRole('button', { name: /Checklist/ }).click();
await page.keyboard.type('Intro to the design lead', { delay: 38 });
await page.keyboard.press('Enter');
await page.keyboard.type('Revisit Q4 scope', { delay: 38 });
await still();
await wait(1200);

// 3. Series history
await box.locator('summary').click();
await caption('Recurring meetings keep their history');
await still();
await wait(3200);

// 4. Privacy (collapse the history first so the popup fits)
await box.locator('summary').click();
await box.getByRole('button', { name: 'About these notes' }).click();
await caption('Only visible to you. Never added to the event or shared with guests.');
await still();
await wait(3600);
await page.keyboard.press('Escape');
await wait(300);

// 5. Dots
await page.keyboard.press('Escape');
await caption('Events with notes get a subtle dot');
await still();
await wait(2600);

// 6. Side panel search
await page.goto(`chrome-extension://${extId}/sidepanel.html`);
await page.addStyleTag({
  content: `html, body { background: #f8fafd !important; }
    .en-root { max-width: 440px; margin: 32px auto 0; min-height: 0 !important; border-radius: 18px;
      box-shadow: 0 6px 28px rgba(0,0,0,.14); padding-bottom: 20px; }`,
});
await caption('Search every note from the side panel');
await page.getByPlaceholder('Search notes and event titles').click();
await page.keyboard.type('Q4', { delay: 120 });
await still();
await wait(3200);

// 7. End card
await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#fff6df;font-family:'Helvetica Neue',Arial,sans-serif;color:#2b2616">
  <div style="text-align:center">
    <div style="width:120px;margin:0 auto 18px">${icon}</div>
    <div style="font-size:48px;font-weight:700">Private Event Notes</div>
    <div style="font-size:26px;color:#7a6a40;margin-top:6px">for Google Calendar</div>
    <div style="font-size:22px;margin-top:34px">Free for 5 notes · Pro from $1 · No account needed</div>
  </div></body></html>`);
await still();
await wait(3500);

const video = page.video();
await context.close();
const out = resolve('store/demo-video.webm');
await rm(out, { force: true });
await rename(await video.path(), out);
await rm(videoDir, { recursive: true, force: true });
console.log('wrote', out);
