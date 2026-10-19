import { getAllNotes, getNote, putNotes, sanitizeNote, type Note } from './notes-store';

export interface ExportFile {
  format: 'gcal-event-notes';
  version: 1;
  exportedAt: string;
  notes: Note[];
}

export async function exportNotes(): Promise<ExportFile> {
  return {
    format: 'gcal-event-notes',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: await getAllNotes(),
  };
}

/** Merges notes from an export file; the more recently edited copy wins. */
export async function importNotes(data: unknown): Promise<{ imported: number; skipped: number }> {
  const file = data as Partial<ExportFile>;
  if (file?.format !== 'gcal-event-notes' || !Array.isArray(file.notes)) {
    throw new Error('This file is not a Private Event Notes export.');
  }
  const toWrite: Note[] = [];
  let skipped = 0;
  for (const raw of file.notes) {
    const note = sanitizeNote(raw);
    const existing = note && (await getNote(note.key));
    if (!note || (existing && existing.updatedAt >= note.updatedAt)) {
      skipped++;
      continue;
    }
    toWrite.push(note);
  }
  await putNotes(toWrite);
  return { imported: toWrite.length, skipped };
}
