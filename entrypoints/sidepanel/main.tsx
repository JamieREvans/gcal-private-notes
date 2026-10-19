import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { Logo } from '../../components/notes-header';
import { formatOccurrence, NoteEditor, openSettings } from '../../components/note-editor';
import { injectPageStyles } from '../../components/page-styles';
import { ProCard } from '../../components/pro-card';
import { usePlanState } from '../../components/use-plan-state';
import { encodeEid, toEventRef, type EventRef } from '../../lib/event-id';
import { noteToMarkdown } from '../../lib/markdown';
import { CURRENT_EVENT_KEY, VISIBLE_EVENTS_KEY, type CurrentEvent } from '../../lib/messages';
import { isSeriesNote, seriesRef, updateNoteText, type Note } from '../../lib/notes-store';
import { todaysPrep, type PrepItem } from '../../lib/prep';
import { collectFollowUps, setTaskDone } from '../../lib/tasks';
import { PinnedNote } from '../../components/pinned-note';

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

type Tab = 'today' | 'followups' | 'all';

function useVisibleEvents(): EventRef[] {
  const [refs, setRefs] = useState<EventRef[]>([]);
  useEffect(() => {
    browser.storage.session.get(VISIBLE_EVENTS_KEY).then((r) => setRefs((r[VISIBLE_EVENTS_KEY] as EventRef[]) ?? []));
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'session' && VISIBLE_EVENTS_KEY in changes) {
        setRefs((changes[VISIBLE_EVENTS_KEY]?.newValue as EventRef[]) ?? []);
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
  return refs;
}

const refOf = (n: Note): EventRef => (isSeriesNote(n) ? seriesRef(n) : toEventRef(n.eventId, n.calendarId));

/** Inline editor for any stored note: occurrence notes and pinned series notes. */
function ExpandedNote({ note, onDone }: { note: Note; onDone: () => void }) {
  return (
    <div class="en-expanded">
      {isSeriesNote(note) ? (
        <div class="en-box">
          <PinnedNote eventRef={refOf(note)} pinned={note} />
        </div>
      ) : (
        <NoteEditor eventRef={refOf(note)} autoFocus />
      )}
      <div class="en-actions">
        {!isSeriesNote(note) && (
          <a href={eventUrl(note)} target="_blank" rel="noreferrer">
            Open in Calendar
          </a>
        )}
        <button type="button" class="en-link" onClick={() => navigator.clipboard.writeText(noteToMarkdown(note))}>
          Copy as Markdown
        </button>
        <button type="button" class="en-link" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function noteLabel(n: Note): string {
  return isSeriesNote(n) ? '📌 Pinned to every occurrence' : formatOccurrence(n);
}

function AllNotes({ notes }: { notes: Note[] }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = notes.filter(
      (n) => !q || n.text.toLowerCase().includes(q) || (n.title ?? '').toLowerCase().includes(q),
    );
    const bySeries = new Map<string, Note[]>();
    for (const n of matches) {
      const k = `${n.calendarId}|${n.seriesId}`;
      bySeries.set(k, [...(bySeries.get(k) ?? []), n]);
    }
    return [...bySeries.entries()]
      .map(([key, group]) => ({
        key,
        notes: group.sort(
          (a, b) =>
            Number(isSeriesNote(b)) - Number(isSeriesNote(a)) ||
            (b.instanceStart ?? '').localeCompare(a.instanceStart ?? '') ||
            b.updatedAt - a.updatedAt,
        ),
        latest: Math.max(...group.map((n) => n.updatedAt)),
      }))
      .sort((a, b) => b.latest - a.latest);
  }, [notes, query]);

  return (
    <>
      <input
        class="en-search"
        type="search"
        placeholder="Search notes and event titles"
        aria-label="Search notes and event titles"
        value={query}
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      {groups.length === 0 && (
        <p class="en-empty">{query ? 'No notes match.' : 'No notes yet. Open an event in Google Calendar to add one.'}</p>
      )}
      {groups.map((g) => {
        const grouped = g.notes.length > 1 || g.notes.some(isSeriesNote);
        return (
          <section class="en-group" key={g.key}>
            {grouped && <h3 class="en-group-title">{g.notes.find((n) => n.title)?.title || 'Recurring event'}</h3>}
            {g.notes.map((n) =>
              expanded === n.key ? (
                <ExpandedNote key={n.key} note={n} onDone={() => setExpanded(null)} />
              ) : (
                <button type="button" class="en-item" key={n.key} onClick={() => setExpanded(n.key)}>
                  <div class="en-date">{grouped ? noteLabel(n) : `${n.title || 'Untitled event'} · ${noteLabel(n)}`}</div>
                  <div class="en-preview">{n.text}</div>
                </button>
              ),
            )}
          </section>
        );
      })}
    </>
  );
}

function FollowUps({ notes }: { notes: Note[] }) {
  const [showDone, setShowDone] = useState(false);
  const groups = useMemo(() => collectFollowUps(notes, showDone), [notes, showDone]);
  const open = useMemo(() => collectFollowUps(notes).reduce((sum, g) => sum + g.tasks.length, 0), [notes]);

  return (
    <>
      <div class="en-tab-toolbar">
        <span class="en-message">
          {open} open {open === 1 ? 'follow-up' : 'follow-ups'}
        </span>
        <label class="en-inline-check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone((e.currentTarget as HTMLInputElement).checked)} />
          Show done
        </label>
      </div>
      {groups.length === 0 && (
        <p class="en-empty">
          Add a follow-up to any note by starting a line with <code>- [ ]</code>. Every open one shows up here.
        </p>
      )}
      {groups.map(({ note, tasks }) => (
        <section class="en-group" key={note.key}>
          <h3 class="en-group-title">
            {note.title || 'Untitled event'} <span class="en-date">· {noteLabel(note)}</span>
          </h3>
          <ul class="en-tasks">
            {tasks.map((t) => (
              <li key={t.line}>
                <label class={t.done ? 'en-task-done' : ''}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => updateNoteText(note, setTaskDone(note.text, t.line, (e.currentTarget as HTMLInputElement).checked))}
                  />
                  {t.text}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Today({ items }: { items: PrepItem[] }) {
  const [writing, setWriting] = useState<string | null>(null);
  if (!items.length) {
    return (
      <p class="en-empty">
        Recurring meetings on today's calendar that have earlier notes or a pinned note show up here, so you can
        prepare in seconds. Keep Google Calendar open on a view that includes today.
      </p>
    );
  }
  return (
    <>
      {items.map((item) => {
        const last = item.previous[0];
        return (
          <section class="en-group en-prep" key={item.ref.key}>
            <h3 class="en-group-title">
              {item.title}
              {item.ref.instanceStart && item.ref.instanceStart.length > 10 && (
                <span class="en-date"> · {new Date(item.ref.instanceStart).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
              )}
            </h3>
            {item.pinned && (
              <div class="en-prep-block">
                <div class="en-date">📌 Pinned</div>
                <div class="en-preview">{item.pinned.text}</div>
              </div>
            )}
            {last && (
              <div class="en-prep-block">
                <div class="en-date">Last time · {formatOccurrence(last)}</div>
                <div class="en-preview">{last.text}</div>
              </div>
            )}
            {writing === item.ref.key ? (
              <NoteEditor eventRef={item.ref} getSnapshot={() => ({ title: item.title })} autoFocus />
            ) : (
              <button type="button" class="en-link" onClick={() => setWriting(item.ref.key)}>
                {item.current ? "Open today's note" : "Write today's note"}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

function App() {
  const plan = usePlanState();
  const current = useCurrentEvent();
  const visible = useVisibleEvents();
  const prep = useMemo(() => todaysPrep(visible, plan.notes), [visible, plan.notes]);
  const [tab, setTab] = useState<Tab | null>(null);
  const activeTab: Tab = tab ?? (prep.length ? 'today' : 'all');

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

      <h2 class="en-section-title">Last opened event</h2>
      {current ? (
        <>
          <p class="en-event-title">{current.snapshot.title || 'Untitled event'}</p>
          {current.snapshot.when && <p class="en-event-when">{current.snapshot.when}</p>}
          <NoteEditor key={current.ref.key} eventRef={current.ref} getSnapshot={() => current.snapshot} />
        </>
      ) : (
        <p class="en-empty">Open an event in Google Calendar and its note shows up here.</p>
      )}

      {!plan.ready ? null : !plan.pro ? (
        <>
          {prep.length > 0 && (
            <p class="en-message en-teaser-line">
              {prep.length} of today's meetings {prep.length === 1 ? 'has' : 'have'} earlier notes.{' '}
              <span class="en-pro">Pro</span> shows them here so you can prepare in seconds.
            </p>
          )}
          <h2 class="en-section-title">More with Pro</h2>
          <ProCard
            pro={false}
            compact
            lead="See today's meetings with their history, every open follow-up, and search across all your notes, right here."
          />
        </>
      ) : (
        <>
          <div class="en-tabs" role="tablist" aria-label="Notes views">
            {(
              [
                ['today', `Today${prep.length ? ` (${prep.length})` : ''}`],
                ['followups', 'Follow-ups'],
                ['all', 'All notes'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                class={`en-tab ${activeTab === id ? 'en-tab-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {activeTab === 'today' && <Today items={prep} />}
            {activeTab === 'followups' && <FollowUps notes={plan.notes} />}
            {activeTab === 'all' && <AllNotes notes={plan.notes} />}
          </div>
        </>
      )}
    </div>
  );
}

injectPageStyles();
render(<App />, document.getElementById('app')!);
