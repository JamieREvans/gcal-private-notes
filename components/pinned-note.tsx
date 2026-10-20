import { useEffect, useRef, useState } from 'preact/hooks';
import type { EventRef } from '../lib/event-id';
import { saveSeriesNote, type EventSnapshot, type Note } from '../lib/notes-store';
import { NoteInput } from './note-input';

const SAVE_DELAY_MS = 400;

interface Props {
  eventRef: EventRef;
  pinned?: Note;
  getSnapshot?: () => EventSnapshot;
  rich?: boolean;
}

/** A standing note shown on every occurrence of a recurring event (Pro). */
export function PinnedNote({ eventRef, pinned, getSnapshot, rich = true }: Props) {
  const [open, setOpen] = useState(!!pinned);
  // Focus the field as it appears when opened by a click, so fast typing isn't lost.
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [text, setText] = useState(pinned?.text ?? '');
  const focused = useRef(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; text: string } | null>(null);

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    saveSeriesNote(eventRef, p.text, getSnapshot?.() ?? {});
  };

  useEffect(() => {
    if (pinned) setOpen(true);
    if (!pending.current && !focused.current) setText(pinned?.text ?? '');
  }, [pinned?.text]);

  useEffect(() => () => flush(), [eventRef.seriesId]);

  if (!open) {
    return (
      <button
        type="button"
        class="en-chip en-pin-add"
        onClick={() => {
          setFocusOnOpen(true);
          setOpen(true);
        }}
      >
        📌 Pin a note to every occurrence
      </button>
    );
  }

  return (
    <div class="en-pinned">
      <label class="en-pinned-label" for={`pin-${eventRef.seriesId}`}>
        📌 Pinned to every occurrence
      </label>
      <NoteInput
        id={`pin-${eventRef.seriesId}`}
        class="en-pinned-text"
        rich={rich}
        autoFocus={focusOnOpen}
        maxHeight={200}
        value={text}
        placeholder="Standing notes for this series, e.g. goals, ongoing topics"
        ariaLabel="Pinned note for every occurrence"
        onInput={(value) => {
          setText(value);
          if (pending.current) clearTimeout(pending.current.timer);
          pending.current = { text: value, timer: setTimeout(flush, SAVE_DELAY_MS) };
        }}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          flush();
          if (!(pending.current?.text ?? text).trim()) setOpen(false);
        }}
      />
    </div>
  );
}
