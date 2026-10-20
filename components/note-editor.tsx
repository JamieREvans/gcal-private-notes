import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EventRef } from '../lib/event-id';
import { sendMessage } from '../lib/messages';
import { toPlainText } from '../lib/plain-text';
import {
  deleteNote,
  isRecurring,
  isSeriesNote,
  saveNote,
  seriesNoteKey,
  type EventSnapshot,
  type Note,
} from '../lib/notes-store';
import { FREE_NOTE_LIMIT, noteLockedByNewNote } from '../lib/plan';
import { isSyncable } from '../lib/sync-mirror';
import { getTemplates, type Template } from '../lib/templates';
import { NoteInput, type InputHandle } from './note-input';
import { NotesHeader } from './notes-header';
import { PinnedNote } from './pinned-note';
import { usePlanState } from './use-plan-state';

const SAVE_DELAY_MS = 400;

interface Props {
  eventRef: EventRef;
  /** Read lazily at save time so the stored title/time reflect the latest DOM. */
  getSnapshot?: () => EventSnapshot;
  autoFocus?: boolean;
}

type Status = 'idle' | 'saving' | 'saved';

export const openUpgrade = () => sendMessage({ type: 'open-upgrade' });
export const openSettings = () => sendMessage({ type: 'open-options' });

export function NoteEditor({ eventRef, getSnapshot, autoFocus }: Props) {
  const plan = usePlanState();
  const [text, setText] = useState('');
  const [hasNote, setHasNote] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [focusedUi, setFocusedUi] = useState(false);
  const [capDismissed, setCapDismissed] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const inputRef = useRef<InputHandle | null>(null);
  const focused = useRef(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; text: string } | null>(null);

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return Promise.resolve();
    clearTimeout(p.timer);
    pending.current = null;
    return saveNote(eventRef, p.text, getSnapshot?.() ?? {}).then(() => setStatus('saved'));
  }, [eventRef.key]);

  // Keep in step with edits made elsewhere (e.g. side panel) without clobbering typing.
  useEffect(() => {
    if (!plan.ready) return;
    const note = plan.notes.find((n) => n.key === eventRef.key);
    setHasNote(!!note);
    if (!pending.current && !focused.current) setText(note?.text ?? '');
    setLoaded(true);
  }, [plan.ready, plan.notes, eventRef.key]);

  useEffect(() => {
    setLoaded(false);
    setStatus('idle');
    setCapDismissed(false);
    focused.current = false;
    return () => {
      flush();
    };
  }, [eventRef.key]);

  useEffect(() => {
    if (plan.pro) getTemplates().then(setTemplates);
  }, [plan.pro]);


  const setValue = (value: string) => {
    setText(value);
    setStatus('saving');
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { text: value, timer: setTimeout(flush, SAVE_DELAY_MS) };
  };

  const header = (status?: ComponentChildren) => (
    <NotesHeader
      status={status}
      onOpenSettings={openSettings}
      onUpgrade={openUpgrade}
      syncEnabled={plan.pro && plan.settings?.syncEnabled}
      pro={plan.pro}
      usedFreeSlots={plan.usedFreeSlots}
    />
  );

  if (loaded && plan.locked.has(eventRef.key)) {
    return (
      <div class="en-box">
        {header()}
        <LockedNotice onDelete={() => deleteNote(eventRef.key)} />
      </div>
    );
  }

  const others = plan.notes.filter(
    (n) =>
      !isSeriesNote(n) &&
      n.key !== eventRef.key &&
      n.calendarId === eventRef.calendarId &&
      n.seriesId === eventRef.seriesId,
  );
  const pinned = plan.notes.find((n) => n.key === seriesNoteKey(eventRef.calendarId, eventRef.seriesId));
  const wouldLock = !hasNote && !capDismissed ? noteLockedByNewNote(plan.notes, plan.pro) : undefined;
  const tooBigToSync =
    plan.pro &&
    plan.settings?.syncEnabled &&
    text.trim() &&
    !isSyncable({ ...eventRef, text, createdAt: 0, updatedAt: 0, ...getSnapshot?.() });

  return (
    <div class="en-box">
      {header(
        <>
          {tooBigToSync && (
            <span class="en-badge" title="Too long for browser sync. It is still saved in this browser.">
              not synced
            </span>
          )}{' '}
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
        </>,
      )}
      {wouldLock && focusedUi && <CapBanner note={wouldLock} onDismiss={() => setCapDismissed(true)} />}
      <NoteInput
        inputRef={inputRef}
        rich={plan.pro && plan.settings?.richText !== false}
        autoFocus={autoFocus}
        value={text}
        onInput={setValue}
        onFocus={() => {
          focused.current = true;
          setFocusedUi(true);
        }}
        onBlur={() => {
          focused.current = false;
          flush();
        }}
        disabled={!loaded}
        placeholder="Private note, only visible to you"
        ariaLabel="Private note for this event"
      />
      {plan.pro && !text && templates.length > 0 && (
        <div class="en-templates">
          <span>Start from:</span>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              class="en-chip"
              onClick={() => {
                setValue(t.body);
                setTimeout(() => inputRef.current?.focus());
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      {plan.pro && isRecurring(eventRef) && (
        <PinnedNote
          eventRef={eventRef}
          pinned={pinned}
          getSnapshot={getSnapshot}
          rich={plan.settings?.richText !== false}
        />
      )}
      {plan.settings?.showSeriesHistory !== false &&
        others.length > 0 &&
        (plan.pro ? <SeriesHistory notes={others} /> : <SeriesTeaser count={others.length} />)}
    </div>
  );
}

function CapBanner({ note, onDismiss }: { note: Note; onDismiss: () => void }) {
  return (
    <div class="en-callout" role="status">
      <p>
        You're using all {FREE_NOTE_LIMIT} free notes. Saving one here will lock your note on{' '}
        <strong>{note.title || 'an earlier event'}</strong>
        {note.instanceStart || note.when ? ` (${formatOccurrence(note)})` : ''}. It's kept safely, not deleted, and
        unlocks when you upgrade.
      </p>
      <div class="en-callout-actions">
        <button type="button" class="en-button en-primary" onClick={openUpgrade}>
          Go unlimited · from $1
        </button>
        <button type="button" class="en-link" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

function LockedNotice({ onDelete }: { onDelete?: () => void }) {
  return (
    <div class="en-callout">
      <p>
        <strong>This note is locked.</strong> The free plan keeps your {FREE_NOTE_LIMIT} most recent notes. Older
        ones are kept safely in this browser and unlock with Pro. They're also included in every export.
      </p>
      <div class="en-callout-actions">
        <button type="button" class="en-button en-primary" onClick={openUpgrade}>
          Unlock with Pro · from $1
        </button>
        <button type="button" class="en-link" onClick={openSettings}>
          Export
        </button>
        {onDelete && (
          <button
            type="button"
            class="en-link"
            onClick={() => confirm('Delete this locked note permanently?') && onDelete()}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function SeriesTeaser({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="en-history">
      <button type="button" class="en-teaser" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {count} {count === 1 ? 'note' : 'notes'} from other occurrences of this event <span class="en-pro">Pro</span>
      </button>
      {open && (
        <div class="en-callout">
          <p>
            Pro shows your notes from earlier occurrences right here, so a recurring 1:1 builds a running history.
          </p>
          <div class="en-callout-actions">
            <button type="button" class="en-button en-primary" onClick={openUpgrade}>
              Upgrade · from $1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesHistory({ notes }: { notes: Note[] }) {
  return (
    <details class="en-history">
      <summary>
        Notes from {notes.length} other {notes.length === 1 ? 'occurrence' : 'occurrences'}
      </summary>
      <ol>
        {notes.map((n) => (
          <li key={n.key}>
            <div class="en-date">{formatOccurrence(n)}</div>
            <div class="en-text">{toPlainText(n.text)}</div>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function formatOccurrence(note: Pick<Note, 'instanceStart' | 'when' | 'updatedAt'>): string {
  if (note.instanceStart) {
    const allDay = note.instanceStart.length === 10;
    const date = new Date(allDay ? `${note.instanceStart}T00:00:00` : note.instanceStart);
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  return note.when || `Edited ${new Date(note.updatedAt).toLocaleDateString()}`;
}
