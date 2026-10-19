import { isSeriesNote, type Note } from './notes-store';

/** A Markdown-style checklist line: "- [ ] call Sam" or "* [x] done". */
const TASK_LINE = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/;

export interface Task {
  /** Line index within the note's text. */
  line: number;
  done: boolean;
  text: string;
}

export function parseTasks(text: string): Task[] {
  const tasks: Task[] = [];
  text.split('\n').forEach((line, i) => {
    const m = TASK_LINE.exec(line);
    if (m && m[2]!.trim()) tasks.push({ line: i, done: m[1] !== ' ', text: m[2]!.trim() });
  });
  return tasks;
}

/** Returns the text with one checklist line ticked or unticked. */
export function setTaskDone(text: string, line: number, done: boolean): string {
  const lines = text.split('\n');
  const current = lines[line];
  if (current === undefined || !TASK_LINE.test(current)) return text;
  lines[line] = current.replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]');
  return lines.join('\n');
}

export interface FollowUpGroup {
  note: Note;
  tasks: Task[];
}

/** Notes with checklist items, most recent meeting first. */
export function collectFollowUps(notes: Note[], includeDone = false): FollowUpGroup[] {
  return notes
    .map((note) => ({ note, tasks: parseTasks(note.text).filter((t) => includeDone || !t.done) }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => {
      // Pinned series notes first (standing items), then by meeting date, then edit time.
      if (isSeriesNote(a.note) !== isSeriesNote(b.note)) return isSeriesNote(a.note) ? -1 : 1;
      const at = a.note.instanceStart ?? '';
      const bt = b.note.instanceStart ?? '';
      if (at !== bt) return at < bt ? 1 : -1;
      return b.note.updatedAt - a.note.updatedAt;
    });
}
