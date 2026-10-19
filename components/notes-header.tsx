import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { FREE_NOTE_LIMIT } from '../lib/plan';

export const EXTENSION_NAME = 'Private Event Notes';

export function Logo({ class: className = 'en-logo' }: { class?: string }) {
  return (
    <svg class={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5V10l-4 5H3.5A1.5 1.5 0 0 1 2 13.5z" fill="#f2b84b" />
      <path d="M14 10h-2.5A1.5 1.5 0 0 0 10 11.5V15z" fill="#c98a1b" />
      <path d="M4.5 4.5h7M4.5 7h7M4.5 9.5h4" stroke="#6b4a0c" stroke-width="1.1" stroke-linecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5A1 1 0 0 1 13 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1.5 0h4V5a2 2 0 0 0-4 0z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M8 7v4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="4.75" r="0.95" fill="currentColor" />
    </svg>
  );
}

interface Props {
  /** Right-aligned slot, e.g. the "Saved" indicator. */
  status?: ComponentChildren;
  onOpenSettings?: () => void;
  onUpgrade?: () => void;
  syncEnabled?: boolean;
  pro?: boolean;
  usedFreeSlots?: number;
}

/**
 * The light-touch branding shown above every note: makes it clear this box
 * comes from an extension (not Google Calendar) and is private to the user.
 */
export function NotesHeader({ status, onOpenSettings, onUpgrade, syncEnabled, pro, usedFreeSlots }: Props) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !e.composedPath().includes(wrapRef.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div class="en-header" ref={wrapRef} onKeyDown={onKeyDown}>
      <Logo />
      <span class="en-name">{EXTENSION_NAME}</span>
      <span aria-hidden="true">·</span>
      <span class="en-private">
        <LockIcon /> Only visible to you
      </span>
      <button
        ref={buttonRef}
        type="button"
        class="en-info-btn"
        aria-label="About these notes"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((o) => !o)}
      >
        <InfoIcon />
      </button>
      <span class="en-spacer" />
      {status && <span class="en-status">{status}</span>}
      {open && (
        <div id={popoverId} class="en-popover" role="dialog" aria-label="About Private Event Notes">
          <p>
            <strong>{EXTENSION_NAME}</strong> is a browser extension. It isn't part of Google Calendar.
          </p>
          <p>
            Your notes are stored only in this browser
            {syncEnabled ? ' and your browser’s own sync' : ''}. They are <strong>never</strong> added to the event
            or shared with guests or organisers.
          </p>
          {pro ? (
            <p>Pro: thanks for supporting a hobby developer!</p>
          ) : (
            usedFreeSlots !== undefined && (
              <p>
                Free plan: {usedFreeSlots} of {FREE_NOTE_LIMIT} notes used.{' '}
                {onUpgrade && (
                  <button type="button" class="en-link" onClick={onUpgrade}>
                    Support a hobby developer and go unlimited, from $1
                  </button>
                )}
              </p>
            )
          )}
          {onOpenSettings && (
            <p>
              <button type="button" class="en-link" onClick={onOpenSettings}>
                Settings, export and backup
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
