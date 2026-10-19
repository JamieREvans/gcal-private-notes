/**
 * Shared styles. Injected into each shadow root and into extension pages, so
 * Google Calendar's CSS and ours never collide. The amber tint deliberately
 * differs from Calendar's own fields so notes don't read as a native feature.
 */
export const STYLES = /* css */ `
:host, .en-root {
  --en-bg: #fffaeb;
  --en-border: #ecd9a4;
  --en-text: #2b2616;
  --en-muted: #7a6a40;
  --en-accent: #a8660b;
  --en-field: #ffffff;
  --en-popover-bg: #ffffff;
  --en-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  all: initial;
  display: block;
  font-family: 'Google Sans Text', Roboto, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: var(--en-text);
}
@media (prefers-color-scheme: dark) {
  :host, .en-root {
    --en-bg: #2a2516;
    --en-border: #5c4d26;
    --en-text: #ece3c8;
    --en-muted: #b9a777;
    --en-accent: #e0a64a;
    --en-field: #1f1c12;
    --en-popover-bg: #2f2b1e;
    --en-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }
}
* { box-sizing: border-box; }

.en-box {
  background: var(--en-bg);
  border: 1px solid var(--en-border);
  border-radius: 8px;
  padding: 8px 10px 10px;
}

.en-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--en-muted);
  user-select: none;
}
.en-header .en-logo { width: 14px; height: 14px; flex: none; }
.en-header .en-name { font-weight: 600; letter-spacing: 0.01em; }
.en-header .en-private { display: inline-flex; align-items: center; gap: 3px; }
.en-header .en-spacer { flex: 1; }
.en-header .en-status { font-size: 11px; }
.en-header .en-popover { flex-basis: 100%; }

.en-info-btn {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--en-muted);
}
.en-info-btn:hover { background: color-mix(in srgb, var(--en-accent) 15%, transparent); }
.en-info-btn:focus-visible { outline: 2px solid var(--en-accent); outline-offset: 1px; }

.en-popover {
  /* In normal flow rather than absolutely positioned: Calendar's dialogs clip overflow. */
  margin: 2px 0 8px;
  padding: 10px 12px;
  background: var(--en-popover-bg);
  color: var(--en-text);
  border: 1px solid var(--en-border);
  border-radius: 8px;
  box-shadow: var(--en-shadow);
  font-size: 12px;
  line-height: 1.45;
  user-select: text;
}
.en-popover p { margin: 0 0 6px; }
.en-popover p:last-child { margin-bottom: 0; }
.en-popover strong { font-weight: 600; }

.en-link {
  all: unset;
  cursor: pointer;
  color: var(--en-accent);
  text-decoration: underline;
}
.en-link:focus-visible { outline: 2px solid var(--en-accent); }

.en-textarea {
  display: block;
  width: 100%;
  min-height: 56px;
  max-height: 320px;
  resize: vertical;
  padding: 6px 8px;
  font: inherit;
  color: var(--en-text);
  background: var(--en-field);
  border: 1px solid var(--en-border);
  border-radius: 6px;
  outline: none;
}
.en-textarea:focus { border-color: var(--en-accent); }
.en-textarea::placeholder { color: var(--en-muted); opacity: 0.8; }

.en-history { margin-top: 8px; }
.en-history summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--en-muted);
}
.en-history ol { list-style: none; margin: 6px 0 0; padding: 0; max-height: 220px; overflow: auto; }
.en-history li { padding: 6px 0; border-top: 1px solid var(--en-border); }
.en-history .en-date { font-size: 11px; font-weight: 600; color: var(--en-muted); }
.en-history .en-text { white-space: pre-wrap; word-break: break-word; }

.en-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid var(--en-border);
}


.en-callout {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--en-popover-bg);
  border: 1px dashed var(--en-border);
  font-size: 12px;
}
.en-callout p { margin: 0 0 6px; }
.en-callout-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.en-history .en-callout { margin-top: 6px; }

.en-button {
  all: unset;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--en-border);
  background: var(--en-bg);
  font-size: 12px;
  font-weight: 500;
}
.en-button:focus-visible { outline: 2px solid var(--en-accent); outline-offset: 1px; }
.en-button.en-primary { background: var(--en-accent); border-color: var(--en-accent); color: #fff; }
@media (prefers-color-scheme: dark) { .en-button.en-primary { color: #1b1a17; } }

.en-templates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; color: var(--en-muted); }
.en-chip {
  all: unset;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--en-border);
  color: var(--en-text);
  font-size: 11px;
}
.en-chip:hover { border-color: var(--en-accent); }
.en-chip:focus-visible { outline: 2px solid var(--en-accent); }

.en-teaser {
  all: unset;
  cursor: pointer;
  font-size: 12px;
  color: var(--en-muted);
}
.en-teaser:focus-visible { outline: 2px solid var(--en-accent); }
.en-pro {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--en-accent);
  border: 1px solid currentColor;
}

.en-pin-add { margin-top: 6px; color: var(--en-muted); }
.en-pinned { margin-top: 8px; }
.en-pinned-label { display: block; font-size: 11px; font-weight: 600; color: var(--en-muted); margin-bottom: 4px; }
.en-pinned-text { min-height: 36px; background: color-mix(in srgb, var(--en-field) 70%, var(--en-bg)); }
`;
