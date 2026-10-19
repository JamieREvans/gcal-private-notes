import { browser } from 'wxt/browser';

/** The extension id registered on extensionpay.com. */
export const EXTPAY_ID = 'private-notes-for-google-calendar';

export interface License {
  paid: boolean;
  email?: string | null;
  /** e.g. "$3.00 once" for display in Settings. */
  planLabel?: string | null;
  checkedAt: number;
  /** Dev builds only: lets you test Pro without paying. */
  devOverride?: boolean;
}

const KEY = 'license';
const FREE: License = { paid: false, checkedAt: 0 };

export async function getLicense(): Promise<License> {
  const res = await browser.storage.local.get(KEY);
  return { ...FREE, ...(res[KEY] as Partial<License> | undefined) };
}

export async function setLicense(patch: Partial<License>): Promise<void> {
  await browser.storage.local.set({ [KEY]: { ...(await getLicense()), ...patch } });
}

export function isPro(license: License | null | undefined): boolean {
  if (!license) return false;
  return license.paid || (import.meta.env.DEV && !!license.devOverride);
}

export function onLicenseChanged(callback: (license: License) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && KEY in changes) {
      callback({ ...FREE, ...(changes[KEY]?.newValue as Partial<License> | undefined) });
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
