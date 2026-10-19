import { STYLES } from './styles';

/** Extra layout for the side panel and options pages (on top of the shared styles). */
export const PAGE_STYLES =
  STYLES +
  /* css */ `
html, body { margin: 0; background: var(--en-page-bg); }
.en-root {
  --en-page-bg: #ffffff;
  min-height: 100vh;
  background: var(--en-page-bg);
  padding: 12px 16px 24px;
  font-size: 14px;
}
@media (prefers-color-scheme: dark) {
  .en-root { --en-page-bg: #1b1a17; }
}
.en-page-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.en-page-header .en-logo { width: 22px; height: 22px; }
.en-page-header h1 { font-size: 16px; font-weight: 600; margin: 0; flex: 1; }
.en-subtitle { color: var(--en-muted); font-size: 12px; margin: 0 0 14px; }
.en-icon-btn {
  all: unset;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  color: var(--en-muted);
  display: inline-flex;
}
.en-icon-btn:hover { background: color-mix(in srgb, var(--en-accent) 15%, transparent); }
.en-icon-btn:focus-visible { outline: 2px solid var(--en-accent); }
.en-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--en-muted);
  margin: 18px 0 8px;
}
.en-event-title { font-weight: 600; margin: 0 0 2px; word-break: break-word; }
.en-event-when { color: var(--en-muted); font-size: 12px; margin: 0 0 8px; }
.en-search {
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  color: var(--en-text);
  background: var(--en-field);
  border: 1px solid var(--en-border);
  border-radius: 8px;
  outline: none;
}
.en-search:focus { border-color: var(--en-accent); }
.en-group { margin-top: 12px; }
.en-group-title { font-weight: 600; font-size: 13px; margin: 0 0 4px; word-break: break-word; }
.en-item {
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
  cursor: pointer;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.en-item:hover { background: var(--en-bg); border-color: var(--en-border); }
.en-item:focus-visible { outline: 2px solid var(--en-accent); }
.en-item .en-date { font-size: 11px; font-weight: 600; color: var(--en-muted); }
.en-item .en-preview {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
.en-expanded { margin: 4px 0 10px; }
.en-actions { display: flex; gap: 12px; margin-top: 6px; font-size: 12px; }
.en-actions a { color: var(--en-accent); }
.en-empty { color: var(--en-muted); font-size: 13px; line-height: 1.5; }
.en-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--en-border); }
.en-row label { flex: 1; cursor: pointer; }
.en-row .en-hint { display: block; color: var(--en-muted); font-size: 12px; margin-top: 2px; }
.en-row input[type="checkbox"] { margin-top: 3px; accent-color: var(--en-accent); }
.en-button { font-size: 13px; padding: 6px 12px; }
.en-button.en-danger { color: #b3261e; }
@media (prefers-color-scheme: dark) { .en-button.en-danger { color: #f2b8b5; } }
.en-button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.en-message { font-size: 12px; color: var(--en-muted); margin-top: 8px; }
.en-options { max-width: 560px; margin: 0 auto; }
.en-tabs { display: flex; gap: 4px; margin: 20px 0 12px; border-bottom: 1px solid var(--en-border); }
.en-tab {
  all: unset;
  cursor: pointer;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--en-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.en-tab:focus-visible { outline: 2px solid var(--en-accent); }
.en-tab-active { color: var(--en-text); border-bottom-color: var(--en-accent); }
.en-tab-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.en-tab-toolbar .en-message { margin: 0; }
.en-inline-check { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--en-muted); cursor: pointer; }
.en-inline-check input, .en-tasks input { accent-color: var(--en-accent); }
.en-tasks { list-style: none; margin: 0 0 4px; padding: 0; }
.en-tasks li { padding: 3px 0; }
.en-tasks label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; word-break: break-word; }
.en-tasks input { margin-top: 3px; }
.en-task-done { color: var(--en-muted); text-decoration: line-through; }
.en-group-title .en-date { font-weight: 400; font-size: 11px; color: var(--en-muted); }
.en-prep { padding: 10px 12px; border: 1px solid var(--en-border); border-radius: 10px; }
.en-prep-block { margin: 6px 0 8px; }
.en-prep-block .en-date { font-size: 11px; font-weight: 600; color: var(--en-muted); }
.en-prep-block .en-preview { display: block; white-space: pre-wrap; word-break: break-word; max-height: 7.2em; overflow: hidden; }
.en-teaser-line { margin-top: 16px; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: var(--en-bg); padding: 1px 4px; border-radius: 4px; }
.en-pro-card { margin-top: 4px; }
.en-pro-card p { margin: 0 0 8px; }
.en-pro-title { font-weight: 600; font-size: 14px; }
.en-feature-list { margin: 0 0 10px; padding-left: 0; list-style: none; }
.en-feature-list li { padding: 2px 0 2px 20px; position: relative; }
.en-feature-list li::before { content: '✓'; position: absolute; left: 2px; color: var(--en-accent); font-weight: 700; }
.en-template { border: 1px solid var(--en-border); border-radius: 8px; padding: 8px; margin-bottom: 8px; }
.en-template input {
  width: 100%;
  margin-bottom: 6px;
  padding: 5px 8px;
  font: inherit;
  font-weight: 600;
  color: var(--en-text);
  background: var(--en-field);
  border: 1px solid var(--en-border);
  border-radius: 6px;
}
.en-disabled { opacity: 0.55; pointer-events: none; }
.en-footer { margin-top: 28px; color: var(--en-muted); font-size: 12px; line-height: 1.5; }
.en-footer a { color: var(--en-accent); }
`;

export function injectPageStyles(): void {
  const style = document.createElement('style');
  style.textContent = PAGE_STYLES;
  document.head.append(style);
}
