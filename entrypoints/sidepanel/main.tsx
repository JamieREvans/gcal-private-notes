import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { Logo } from '../../components/notes-header';
import { formatOccurrence, NoteEditor, openSettings } from '../../components/note-editor';
import { injectPageStyles } from '../../components/page-styles';
import { ProCard } from '../../components/pro-card';
import { usePlanState } from '../../components/use-plan-state';
import { encodeEid, toEventRef } from '../../lib/event-id';
import { noteToMarkdown } from '../../lib/markdown';
import { CURRENT_EVENT_KEY, type CurrentEvent } from '../../lib/messages';
import type { Note } from '../../lib/notes-store';

function useCurrentEvent(): CurrentEvent | null {
  const [current, setCurrent] = useState<CurrentEvent | null>(null);
  useEffect(() => {
    browser.storage.session.get(CURRENT_EVENT_KEY).then((r) => setCurrent((r[CURRENT_EVENT_KEY] as CurrentEvent) ?? null));
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'session' && CURRENT_EVENT_KEY in changes) {
        setCurrent((changes[CURRENT_EVENT_KEY]?.newValue as CurrentEvent) ?? null);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
  return current;
}

export function eventUrl(note: Note): string {
  return note.url || `https://calendar.google.com/calendar/event?eid=${encodeEid(note.eventId, note.calendarId)}`;
}

function App() {
  const plan = usePlanState();
  const current = useCurrentEvent();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = plan.notes.filter(
      (n) => !q || n.text.toLowerCase().includes(q) || (n.title ?? '').toLowerCase().includes(q),
    );
    const bySeries = new Map<string, Note[]>();
    for (const n of matches) {
      const k = `${n.calendarId}|${n.seriesId}`;
      bySeries.set(k, [...(bySeries.get(k) ?? []), n]);
    }
    return [...bySeries.entries()]
      .map(([key, notes]) => ({
        key,
        notes: notes.sort(
          (a, b) => (b.instanceStart ?? '').localeCompare(a.instanceStart ?? '') || b.updatedAt - a.updatedAt,
        ),
        latest: Math.max(...notes.map((n) => n.updatedAt)),
      }))
      .sort((a, b) => b.latest - a.latest);
  }, [plan.notes, query]);

  return (
    <div class="en-root">
      <header class="en-page-header">
        <Logo />
        <h1>Private Event Notes</h1>
        <button type="button" class="en-icon-btn" aria-label="Settings" title="Settings" onClick={openSettings}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
              transform="translate(-1 0)"
            />
          </svg>
        </button>
      </header>
      <p class="en-subtitle">Only visible to you. A browser extension, not part of Google Calendar.</p>

      <h2 class="en-section-title">This event</h2>
      {current ? (
        <>
          <p class="en-event-title">{current.snapshot.title || 'Untitled event'}</p>
          {current.snapshot.when && <p class="en-event-when">{current.snapshot.when}</p>}
          <NoteEditor key={current.ref.key} eventRef={current.ref} getSnapshot={() => current.snapshot} />
        </>
      ) : (
        <p class="en-empty">Open an event in Google Calendar and its note shows up here.</p>
      )}

      <h2 class="en-section-title">All notes</h2>
      {!plan.ready ? null : !plan.pro ? (
        <ProCard
          pro={false}
          compact
          lead={
            plan.notes.length > 1
              ? `Browse and search all ${plan.notes.length} of your notes here with Pro.`
              : 'Browse and search all your notes here with Pro.'
          }
        />
      ) : (
        <>
          <input
            class="en-search"
            type="search"
            placeholder="Search notes and event titles"
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          />
          {groups.length === 0 && (
            <p class="en-empty">{query ? 'No notes match.' : 'No notes yet. Open an event in Google Calendar to add one.'}</p>
          )}
          {groups.map((g) => (
            <section class="en-group" key={g.key}>
              {g.notes.length > 1 && <h3 class="en-group-title">{g.notes[0]!.title || 'Recurring event'}</h3>}
              {g.notes.map((n) =>
                expanded === n.key ? (
                  <div class="en-expanded" key={n.key}>
                    <NoteEditor eventRef={toEventRef(n.eventId, n.calendarId)} autoFocus />
                    <div class="en-actions">
                      <a href={eventUrl(n)} target="_blank" rel="noreferrer">
                        Open in Calendar
                      </a>
                      <button type="button" class="en-link" onClick={() => navigator.clipboard.writeText(noteToMarkdown(n))}>
                        Copy as Markdown
                      </button>
                      <button type="button" class="en-link" onClick={() => setExpanded(null)}>
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" class="en-item" key={n.key} onClick={() => setExpanded(n.key)}>
                    <div class="en-date">
                      {g.notes.length > 1 ? formatOccurrence(n) : `${n.title || 'Untitled event'} · ${formatOccurrence(n)}`}
                    </div>
                    <div class="en-preview">{n.text}</div>
                  </button>
                ),
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

injectPageStyles();
render(<App />, document.getElementById('app')!);
