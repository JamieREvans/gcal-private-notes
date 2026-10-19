import type { Note } from './notes-store';

function occurrenceLabel(note: Note): string {
  if (note.instanceStart) return note.instanceStart.length === 10 ? note.instanceStart : note.instanceStart.slice(0, 16).replace('T', ' ') + ' UTC';
  return note.when ?? new Date(note.createdAt).toISOString().slice(0, 10);
}

export function noteToMarkdown(note: Note): string {
  const title = note.title || 'Untitled event';
  const lines = [`## ${title} — ${occurrenceLabel(note)}`];
  if (note.when) lines.push(`*${note.when}*`);
  if (note.url) lines.push(`[Open in Google Calendar](${note.url})`);
  lines.push('', note.text.trim(), '');
  return lines.join('\n');
}

/** All notes as one Markdown document, grouped by recurring series, newest first. */
export function notesToMarkdown(notes: Note[], exportedAt = new Date()): string {
  const groups = new Map<string, Note[]>();
  for (const n of notes) {
    const k = `${n.calendarId}|${n.seriesId}`;
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  const sorted = [...groups.values()]
    .map((g) => g.sort((a, b) => (b.instanceStart ?? '').localeCompare(a.instanceStart ?? '') || b.updatedAt - a.updatedAt))
    .sort((a, b) => Math.max(...b.map((n) => n.updatedAt)) - Math.max(...a.map((n) => n.updatedAt)));

  const out = [`# Private Event Notes`, ``, `Exported ${exportedAt.toISOString().slice(0, 10)}.`, ``];
  for (const group of sorted) {
    if (group.length > 1) out.push(`# ${group[0]!.title || 'Recurring event'} (${group.length} occurrences)`, '');
    for (const n of group) out.push(noteToMarkdown(n));
  }
  return out.join('\n');
}
