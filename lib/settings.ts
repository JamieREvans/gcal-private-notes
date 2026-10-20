import { browser } from 'wxt/browser';

export interface Settings {
  showInPopup: boolean;
  showOnEventPage: boolean;
  showMarkers: boolean;
  showSeriesHistory: boolean;
  /** Pro: formatted editing (bold, headings, lists) instead of plain text. */
  richText: boolean;
  /** Mirror notes into browser sync storage (oldest are evicted from sync only). */
  syncEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  showInPopup: true,
  showOnEventPage: true,
  showMarkers: true,
  showSeriesHistory: true,
  richText: true,
  syncEnabled: false,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const res = await browser.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(res[KEY] as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && KEY in changes) {
      callback({ ...DEFAULT_SETTINGS, ...(changes[KEY]?.newValue as Partial<Settings> | undefined) });
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
