import { render } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { NoteEditor } from '../components/note-editor';
import { toEventRef } from '../lib/event-id';
import { setLicense } from '../lib/license';
import { updateSettings } from '../lib/settings';
import { putNote, type Note } from '../lib/notes-store';

const note = (id: string, updatedAt: number, title = `Event ${id}`): Note => ({
  ...toEventRef(id, 'cal'),
  text: `note ${id}`,
  title,
  createdAt: updatedAt,
  updatedAt,
});

async function renderEditor(id: string) {
  const root = document.createElement('div');
  document.body.append(root);
  await act(async () => {
    render(<NoteEditor eventRef={toEventRef(id, 'cal')} />, root);
  });
  await act(() => new Promise((r) => setTimeout(r, 20)));
  return root;
}

beforeEach(() => {
  fakeBrowser.reset();
  document.body.innerHTML = '';
});

describe('NoteEditor', () => {
  it('always shows the extension name and privacy cue', async () => {
    const root = await renderEditor('new');
    expect(root.textContent).toContain('Private Event Notes');
    expect(root.textContent).toContain('Only visible to you');
    expect(root.querySelector('textarea')?.placeholder).toBe('Private note, only visible to you');
  });

  it('warns which note will lock when a free user starts a 6th note', async () => {
    for (let i = 0; i < 5; i++) await putNote(note(`e${i}`, 100 + i));
    const root = await renderEditor('new');
    await act(async () => {
      root.querySelector('textarea')!.dispatchEvent(new FocusEvent('focus'));
    });
    expect(root.textContent).toContain('lock your note on Event e0');
    expect(root.textContent).toContain('from $1');
  });

  it('shows a locked notice instead of the text for locked notes', async () => {
    for (let i = 0; i < 6; i++) await putNote(note(`e${i}`, 100 + i));
    const root = await renderEditor('e0');
    expect(root.textContent).toContain('This note is locked');
    expect(root.querySelector('textarea')).toBeNull();
    expect(root.textContent).not.toContain('note e0');
  });

  it('never warns or locks for Pro', async () => {
    await setLicense({ paid: true });
    await updateSettings({ richText: false });
    for (let i = 0; i < 6; i++) await putNote(note(`e${i}`, 100 + i));
    const locked = await renderEditor('e0');
    expect(locked.textContent).not.toContain('locked');
    expect(locked.querySelector('textarea')?.value).toBe('note e0');
  });

  it('falls back to plain text when the rich editor cannot load', async () => {
    await setLicense({ paid: true });
    await putNote(note('e0', 100));
    const root = await renderEditor('e0');
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(root.querySelector('textarea')?.value).toBe('note e0');
  });
});
