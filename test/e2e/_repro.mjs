import { chromium } from 'playwright';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join, resolve } from 'node:path';
const EXT = resolve('dist/chrome-mv3');
const MOCK = await readFile(resolve('test/e2e/mock-calendar.html'), 'utf8');
const ctx = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'repro-')), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--host-resolver-rules=MAP extensionpay.com 127.0.0.1'] });
await ctx.route('https://calendar.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: MOCK }));
let [w] = ctx.serviceWorkers(); w ??= await ctx.waitForEvent('serviceworker');
const page = await ctx.newPage();
await page.goto('https://calendar.google.com/calendar/u/0/r/week');
await page.waitForTimeout(600);
await w.evaluate(() => chrome.storage.local.set({ license: { paid: true, checkedAt: Date.now() } }));
const notes = async () => Object.entries(await w.evaluate(() => chrome.storage.local.get(null))).filter(([k]) => k.startsWith('note:')).map(([k, v]) => `${k.slice(5)} = ${JSON.stringify(v.text)}`);
const box = page.locator('[role=dialog] event-notes');
for (const [label, action] of [['open+close', async () => {}], ['open+click+close', async () => { await box.locator('.en-rich-content').first().click(); await page.waitForTimeout(200); }]]) {
  for (const title of ['Weekly 1:1 with Sam', 'Dentist']) {
    await page.getByText(title).first().click();
    await box.locator('.en-rich-content').first().waitFor();
    await action();
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    console.log(label, title, '→', JSON.stringify(await notes()));
  }
}
await ctx.close();
