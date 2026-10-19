import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EventRef } from '../lib/event-id';
import { saveSeriesNote, type EventSnapshot, type Note } from '../lib/notes-store';

const SAVE_DELAY_MS = 400;

interface Props {
  eventRef: EventRef;
  pinned?: Note;
  getSnapshot?: () => EventSnapshot;
}

/** A standing note shown on every occurrence of a recurring event (Pro). */
export function PinnedNote({ eventRef, pinned, getSnapshot }: Props) {
  const [open, setOpen] = useState(!!pinned);
  const [text, setText] = useState(pinned?.text ?? '');
  const focused = useRef(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusOnOpen = useRef(false);

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

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 200)}px`;
  }, [text, open]);

  // Focus in the same frame the textarea appears, so fast typing isn't lost.
  useLayoutEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false;
      textareaRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        class="en-chip en-pin-add"
        onClick={() => {
          focusOnOpen.current = true;
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
      <textarea
        id={`pin-${eventRef.seriesId}`}
        ref={textareaRef}
        class="en-textarea en-pinned-text"
        value={text}
        placeholder="Standing notes for this series, e.g. goals, ongoing topics"
        onInput={(e) => {
          const value = (e.currentTarget as HTMLTextAreaElement).value;
          setText(value);
          if (pending.current) clearTimeout(pending.current.timer);
          pending.current = { text: value, timer: setTimeout(flush, SAVE_DELAY_MS) };
        }}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          flush();
          if (!text.trim()) setOpen(false);
        }}
      />
    </div>
  );
}
