import { getAllNotes, getNote, putNotes, type Note } from './notes-store';

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
    throw new Error('This file is not an Event Notes export.');
  }
  const toWrite: Note[] = [];
  let skipped = 0;
  for (const note of file.notes) {
    if (!isNote(note)) {
      skipped++;
      continue;
    }
    const existing = await getNote(note.key);
    if (existing && existing.updatedAt >= note.updatedAt) {
      skipped++;
      continue;
    }
    toWrite.push(note);
  }
  await putNotes(toWrite);
  return { imported: toWrite.length, skipped };
}

function isNote(value: unknown): value is Note {
  const n = value as Note;
  return (
    typeof n?.key === 'string' &&
    typeof n.calendarId === 'string' &&
    typeof n.eventId === 'string' &&
    typeof n.seriesId === 'string' &&
    typeof n.text === 'string' &&
    typeof n.updatedAt === 'number' &&
    typeof n.createdAt === 'number'
  );
}
