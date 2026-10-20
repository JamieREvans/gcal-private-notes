import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { RichCommand, RichEditor } from '../editor/rich-editor';
import { loadRichEditor } from '../lib/load-editor';

export interface InputHandle {
  focus(): void;
}

interface Props {
  value: string;
  onInput: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Pro: formatted editing (saved as Markdown). Falls back to plain text if the editor can't load. */
  rich?: boolean;
  /** Extra class for size variants (e.g. the pinned note). */
  class?: string;
  maxHeight?: number;
  inputRef?: { current: InputHandle | null };
  id?: string;
}

/** The note's text field: a plain textarea, or (Pro) a rich-text editor that stores Markdown. */
export function NoteInput(props: Props) {
  const [richFailed, setRichFailed] = useState(false);
  return props.rich && !richFailed ? (
    <RichInput {...props} onFail={() => setRichFailed(true)} />
  ) : (
    <PlainInput {...props} />
  );
}

function PlainInput({ value, onInput, onFocus, onBlur, placeholder, ariaLabel, disabled, autoFocus, maxHeight = 320, inputRef, id, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, maxHeight)}px`;
  }, [value, disabled]);

  useEffect(() => {
    if (inputRef) inputRef.current = { focus: () => ref.current?.focus() };
  }, []);
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [disabled]);

  return (
    <textarea
      id={id}
      ref={ref}
      class={`en-textarea ${rest.class ?? ''}`}
      value={value}
      onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      spellcheck
    />
  );
}

const TOOLS: { command: RichCommand; label: string; title: string; glyph: ComponentChildren }[] = [
  { command: 'h1', label: 'Large heading', title: 'Large heading', glyph: <span class="en-tool-text">H1</span> },
  { command: 'h2', label: 'Heading', title: 'Heading', glyph: <span class="en-tool-text">H2</span> },
  { command: 'bold', label: 'Bold', title: 'Bold (⌘B)', glyph: <b>B</b> },
  { command: 'italic', label: 'Italic', title: 'Italic (⌘I)', glyph: <i>I</i> },
  { command: 'strike', label: 'Strikethrough', title: 'Strikethrough', glyph: <s>S</s> },
  {
    command: 'bullet',
    label: 'Bulleted list',
    title: 'Bulleted list',
    glyph: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="2.5" cy="4" r="1.3" fill="currentColor" />
        <circle cx="2.5" cy="8" r="1.3" fill="currentColor" />
        <circle cx="2.5" cy="12" r="1.3" fill="currentColor" />
        <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    command: 'ordered',
    label: 'Numbered list',
    title: 'Numbered list',
    glyph: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <text x="0" y="6" font-size="5.5" fill="currentColor" font-family="sans-serif">1</text>
        <text x="0" y="13.5" font-size="5.5" fill="currentColor" font-family="sans-serif">2</text>
        <path d="M6 4h8M6 11.5h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    ),
  },
  {
    command: 'task',
    label: 'Checklist (shows in Follow-ups)',
    title: 'Checklist (shows in Follow-ups)',
    glyph: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path d="M4.5 8l2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    ),
  },
  {
    command: 'link',
    label: 'Link',
    title: 'Link',
    glyph: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg>
    ),
  },
];

function RichInput({ onFail, ...props }: Props & { onFail: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichEditor | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  // Markdown this editor has produced since the last outside change. Renders can lag
  // a few keystrokes behind the editor, so any of these coming back is just an echo.
  const emitted = useRef(new Set([props.value]));
  const [focused, setFocused] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadRichEditor()
      .then(({ createRichEditor }) => {
        if (cancelled || !hostRef.current) return;
        const p = latest.current;
        editorRef.current = createRichEditor(hostRef.current, {
          markdown: p.value,
          placeholder: p.placeholder,
          ariaLabel: p.ariaLabel,
          editable: !p.disabled,
          onChange: (md) => {
            const seen = emitted.current;
            seen.add(md);
            if (seen.size > 200) seen.delete(seen.values().next().value!);
            latest.current.onInput(md);
          },
          onFocus: () => {
            setFocused(true);
            latest.current.onFocus?.();
          },
          onBlur: () => {
            setFocused(false);
            latest.current.onBlur?.();
          },
          onState: () => setTick((n) => n + 1),
        });
        if (p.inputRef) p.inputRef.current = { focus: () => editorRef.current?.focus() };
        setReady(true);
        if (p.autoFocus && !p.disabled) editorRef.current.focus();
      })
      .catch((err) => {
        console.warn('[Private Event Notes] rich editor unavailable, using plain text', err);
        if (!cancelled) onFail();
      });
    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  // Changes from outside (templates, side panel, sync). The parent only passes those
  // when the user isn't mid-edit here, so they always win.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && !emitted.current.has(props.value)) {
      editor.setMarkdown(props.value);
      emitted.current = new Set([props.value]);
    }
  }, [props.value, ready]);

  useEffect(() => {
    editorRef.current?.setEditable(!props.disabled);
  }, [props.disabled, ready]);

  const editor = editorRef.current;
  return (
    <div class={`en-rich ${focused ? 'en-rich-focused' : ''} ${props.class ?? ''}`}>
      {editor && (
        // Always rendered (dimmed when idle) so the note doesn't jump when you click into it.
        <div class={`en-toolbar ${focused ? '' : 'en-toolbar-idle'}`} role="toolbar" aria-label="Formatting">
          {TOOLS.map((t) => (
            <button
              key={t.command}
              type="button"
              class={`en-tool ${editor.isActive(t.command) ? 'en-tool-active' : ''}`}
              aria-label={t.label}
              aria-pressed={editor.isActive(t.command)}
              title={t.title}
              // Keep focus (and the selection) in the editor.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.run(t.command)}
            >
              {t.glyph}
            </button>
          ))}
        </div>
      )}
      {!ready && <div class="en-rich-loading">{props.value || props.placeholder}</div>}
      <div ref={hostRef} id={props.id} class="en-rich-host" style={{ maxHeight: props.maxHeight ?? 320 }} />
    </div>
  );
}
