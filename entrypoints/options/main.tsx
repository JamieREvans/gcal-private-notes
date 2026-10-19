import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { Logo } from '../../components/notes-header';
import { injectPageStyles } from '../../components/page-styles';
import { ProCard } from '../../components/pro-card';
import { usePlanState } from '../../components/use-plan-state';
import { exportNotes, importNotes } from '../../lib/export';
import { setLicense } from '../../lib/license';
import { notesToMarkdown } from '../../lib/markdown';
import { sendMessage } from '../../lib/messages';
import { deleteAllNotes } from '../../lib/notes-store';
import { FREE_NOTE_LIMIT } from '../../lib/plan';
import { updateSettings, type Settings } from '../../lib/settings';
import { BUDGET_BYTES, SYNC_PREFIX } from '../../lib/sync-mirror';
import { DEFAULT_TEMPLATES, getTemplates, saveTemplates, type Template } from '../../lib/templates';

const PRIVACY_POLICY_URL = 'https://github.com/JamieREvans/gcal-private-notes/blob/main/PRIVACY.md';

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const today = () => new Date().toISOString().slice(0, 10);

function Toggle(props: { label: string; hint?: string; checked: boolean; disabled?: boolean; pro?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class={`en-row ${props.disabled ? 'en-disabled' : ''}`}>
      <input
        id={props.label}
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <label for={props.label}>
        {props.label}
        {props.pro && <span class="en-pro">Pro</span>}
        {props.hint && <span class="en-hint">{props.hint}</span>}
      </label>
    </div>
  );
}

function SyncStatus() {
  const [status, setStatus] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    const load = async () => {
      const all = await browser.storage.sync.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(SYNC_PREFIX) && !(all[k] as { deleted?: boolean }).deleted);
      setStatus({ count: keys.length, bytes: await browser.storage.sync.getBytesInUse(null) });
    };
    load();
    browser.storage.onChanged.addListener(load);
    return () => browser.storage.onChanged.removeListener(load);
  }, []);
  if (!status) return null;
  return (
    <p class="en-message">
      {status.count} notes currently in browser sync ({Math.round(status.bytes / 1024)} KB of{' '}
      {Math.round(BUDGET_BYTES / 1024)} KB). When it's full, the oldest notes leave sync but stay in this browser.
    </p>
  );
}

function Templates({ enabled }: { enabled: boolean }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);
  if (!templates) return null;

  const update = (next: Template[]) => {
    setTemplates(next);
    saveTemplates(next);
  };

  return (
    <div class={enabled ? '' : 'en-disabled'}>
      {templates.map((t, i) => (
        <div class="en-template" key={t.id}>
          <input
            aria-label="Template name"
            value={t.name}
            onInput={(e) => update(templates.map((x, j) => (j === i ? { ...x, name: (e.currentTarget as HTMLInputElement).value } : x)))}
          />
          <textarea
            class="en-textarea"
            aria-label={`${t.name} template`}
            rows={5}
            value={t.body}
            onInput={(e) => update(templates.map((x, j) => (j === i ? { ...x, body: (e.currentTarget as HTMLTextAreaElement).value } : x)))}
          />
          <div class="en-button-row">
            <button type="button" class="en-link" onClick={() => update(templates.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div class="en-button-row">
        <button
          type="button"
          class="en-button"
          onClick={() => update([...templates, { id: crypto.randomUUID(), name: 'New template', body: '' }])}
        >
          Add template
        </button>
        <button type="button" class="en-link" onClick={() => update(DEFAULT_TEMPLATES)}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function App() {
  const plan = usePlanState();
  const [message, setMessage] = useState('');
  const settings = plan.settings;

  useEffect(() => {
    // Pick up a purchase made in another tab promptly.
    sendMessage({ type: 'refresh-license' });
  }, []);

  if (!plan.ready || !settings) return null;
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = await importNotes(JSON.parse(await file.text()));
      setMessage(`Imported ${result.imported} notes${result.skipped ? `, skipped ${result.skipped} that were already up to date` : ''}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const onDeleteAll = async () => {
    if (!confirm(`Delete all ${plan.notes.length} notes from this browser? Export first if you want a backup.`)) return;
    await deleteAllNotes();
    setMessage('All notes deleted.');
  };

  return (
    <div class="en-root">
      <div class="en-options">
        <header class="en-page-header">
          <Logo />
          <h1>Private Event Notes settings</h1>
        </header>
        <p class="en-subtitle">
          Private notes on your Google Calendar events. They're stored in this browser and never shared with guests.
        </p>

        <ProCard pro={plan.pro} license={plan.license} />
        {!plan.pro && (
          <p class="en-message">
            Free plan: {plan.notes.length} {plan.notes.length === 1 ? 'note' : 'notes'} saved,{' '}
            {Math.min(plan.notes.length, FREE_NOTE_LIMIT)} of {FREE_NOTE_LIMIT} unlocked
            {plan.locked.size > 0 && `, ${plan.locked.size} locked until you upgrade`}.
          </p>
        )}

        <h2 class="en-section-title">Where notes appear</h2>
        <Toggle label="Event details popup" hint="The card that opens when you click an event." checked={settings.showInPopup} onChange={(v) => set({ showInPopup: v })} />
        <Toggle label="Full event page" hint="When you open an event to view or edit it." checked={settings.showOnEventPage} onChange={(v) => set({ showOnEventPage: v })} />
        <Toggle label="Dot on events with notes" hint="A small marker on calendar grid events that have a note." checked={settings.showMarkers} onChange={(v) => set({ showMarkers: v })} />
        <Toggle
          label="Series history"
          hint="Notes from other occurrences of a recurring event, shown under the note."
          pro={!plan.pro}
          checked={settings.showSeriesHistory}
          onChange={(v) => set({ showSeriesHistory: v })}
        />

        <h2 class="en-section-title">Sync</h2>
        <Toggle
          label="Sync notes across browsers"
          hint="Uses your browser's own sync (Chrome profile sync). Notes always stay in this browser too. Brave's sync may not carry extension data."
          pro={!plan.pro}
          disabled={!plan.pro}
          checked={plan.pro && settings.syncEnabled}
          onChange={(v) => set({ syncEnabled: v })}
        />
        {plan.pro && settings.syncEnabled && <SyncStatus />}

        <h2 class="en-section-title">
          Templates {!plan.pro && <span class="en-pro">Pro</span>}
        </h2>
        <p class="en-message">Shown as one-click starters when a note is empty.</p>
        <Templates enabled={plan.pro} />

        <h2 class="en-section-title">Backup</h2>
        <p class="en-message">Exports always include every note, including locked ones.</p>
        <div class="en-button-row">
          <button
            type="button"
            class="en-button"
            onClick={async () => download(`private-event-notes-${today()}.json`, JSON.stringify(await exportNotes(), null, 2), 'application/json')}
          >
            Export (JSON)
          </button>
          <button
            type="button"
            class={`en-button ${plan.pro ? '' : 'en-disabled'}`}
            disabled={!plan.pro}
            onClick={() => download(`private-event-notes-${today()}.md`, notesToMarkdown(plan.notes), 'text/markdown')}
          >
            Export as Markdown {!plan.pro && <span class="en-pro">Pro</span>}
          </button>
          <label class="en-button">
            Import (JSON)
            <input type="file" accept="application/json,.json" hidden onChange={onImport} />
          </label>
          <button type="button" class="en-button en-danger" onClick={onDeleteAll}>
            Delete all notes
          </button>
        </div>
        {message && <p class="en-message" role="status">{message}</p>}

        {import.meta.env.DEV && (
          <>
            <h2 class="en-section-title">Developer</h2>
            <Toggle
              label="Simulate Pro (dev builds only)"
              checked={!!plan.license?.devOverride}
              onChange={(v) => setLicense({ devOverride: v })}
            />
          </>
        )}

        <footer class="en-footer">
          Private Event Notes is an independent extension made by a hobby developer. It isn't affiliated with Google. Notes
          stay in this browser (and your browser's own sync, if you turn it on). Payments are handled by
          ExtensionPay and Stripe.{' '}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </footer>
      </div>
    </div>
  );
}

injectPageStyles();
render(<App />, document.getElementById('app')!);
