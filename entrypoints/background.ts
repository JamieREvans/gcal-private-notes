import ExtPay from 'extpay';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { EXTPAY_ID, getLicense, isPro, setLicense, type License } from '../lib/license';
import { CURRENT_EVENT_KEY, type Message } from '../lib/messages';
import { DEFAULT_SETTINGS, getSettings } from '../lib/settings';
import { fullSync, startSyncMirror } from '../lib/sync-mirror';

type ExtPayUser = Awaited<ReturnType<ReturnType<typeof ExtPay>['getUser']>>;

function formatPlan(user: ExtPayUser): string | null {
  const plan = user.plan;
  if (!plan) return null;
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency.toUpperCase() }).format(
    plan.unitAmountCents / 100,
  );
  return plan.interval === 'once' ? amount : `${amount} / ${plan.interval}`;
}

async function saveUser(user: ExtPayUser) {
  await setLicense({ paid: user.paid, email: user.email, planLabel: formatPlan(user), checkedAt: Date.now() });
}

/** Asks ExtensionPay for the paid status; keeps the cached value if offline. */
async function refreshLicense() {
  try {
    await saveUser(await ExtPay(EXTPAY_ID).getUser());
  } catch (err) {
    console.warn('[Private Event Notes] could not check Pro status', err);
  }
}

async function syncAllowed() {
  const [settings, license] = await Promise.all([getSettings(), getLicense()]);
  return settings.syncEnabled && isPro(license);
}

export default defineBackground(() => {
  const extpay = ExtPay(EXTPAY_ID);
  extpay.startBackground();
  extpay.onPaid.addListener((user) => saveUser(user));

  // Toolbar button opens the side panel. Some Chromium builds (older Brave) lack
  // the sidePanel API, so fall back to opening the same page in a tab.
  const sidePanel = browser.sidePanel as typeof browser.sidePanel | undefined;
  if (sidePanel?.setPanelBehavior) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  } else {
    browser.action.onClicked.addListener(() => {
      browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html') });
    });
  }

  browser.runtime.onMessage.addListener((message: Message) => {
    switch (message.type) {
      case 'open-options':
        browser.runtime.openOptionsPage();
        break;
      case 'open-upgrade':
        ExtPay(EXTPAY_ID).openPaymentPage().catch((err) => console.warn('[Private Event Notes] payment page failed', err));
        break;
      case 'open-login':
        ExtPay(EXTPAY_ID).openLoginPage().catch((err) => console.warn('[Private Event Notes] login page failed', err));
        break;
      case 'refresh-license':
        refreshLicense();
        break;
      case 'current-event':
        browser.storage.session.set({ [CURRENT_EVENT_KEY]: message.event });
        break;
    }
  });

  browser.runtime.onInstalled.addListener(refreshLicense);
  browser.runtime.onStartup.addListener(async () => {
    await refreshLicense();
    if (await syncAllowed()) await fullSync();
  });

  startSyncMirror(syncAllowed);

  // Run a full sync when sync is switched on (or Pro unlocks with it already on).
  // Switching it off just stops syncing; Settings has an explicit "remove from sync".
  // Uses the change's old/new values: the worker may have just woken with no memory.
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !('settings' in changes || 'license' in changes)) return;
    const [settings, license] = await Promise.all([getSettings(), getLicense()]);
    const value = <T,>(key: string, current: T, defaults: T, which: 'oldValue' | 'newValue') =>
      key in changes ? ({ ...defaults, ...(changes[key]?.[which] as Partial<T> | undefined) } as T) : current;
    const allowedAt = (which: 'oldValue' | 'newValue') =>
      value('settings', settings, DEFAULT_SETTINGS, which).syncEnabled &&
      isPro(value<License>('license', license, { paid: false, checkedAt: 0 }, which));
    const was = allowedAt('oldValue');
    const now = allowedAt('newValue');
    const log = (err: unknown) => console.warn('[Private Event Notes] sync failed', err);
    if (now && !was) fullSync().catch(log);
  });
});
