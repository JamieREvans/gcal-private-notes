import { afterEach, describe, expect, it } from 'vitest';
import { createRichEditor, sanitizePastedHTML, type RichEditor } from '../editor/rich-editor';
import { docToText, textToDoc, type Doc } from '../editor/text-format';

let editor: RichEditor | undefined;
afterEach(() => editor?.destroy());

/** Open a note in the real editor and read it back, as reopening a note does. */
function reopen(text: string): string {
  const el = document.createElement('div');
  document.body.append(el);
  editor?.destroy();
  editor = createRichEditor(el, { text });
  return editor.getText();
}

describe('notes reopen exactly as written', () => {
  it("keeps indented lines and blank lines (the agenda that lost its sub-items)", () => {
    const agenda = [
      '**[15m]** Brokerage',
      '    **[10m]** Overview and News',
      '    **[5m]** Product',
      '',
      '**[15m]** Lending Services',
      '    **[10m]** Overview and News',
      '    **[5m]** Operations',
    ].join('\n');
    expect(reopen(agenda)).toBe(agenda);
    expect(reopen(reopen(agenda))).toBe(agenda);
  });

  const exact: [string, string][] = [
    ['several blank lines between sections', 'Section one\n\n\n\nSection two\n\n'],
    ['leading and trailing spaces', '   indented start\nend with spaces   \n\ttabbed'],
    ['everyday punctuation stays literal', '2 * 3 * 4 = 24, snake_case_name, a < b & c > d, C++, 50% done, #hashtag, [draft]'],
    ['formatting', '# Agenda\n## Details\n**Decisions** and *ideas* and ~~dropped~~ and `code`'],
    ['lists, nesting, tasks and quotes', '- one\n  - nested\n    - deeper\n- two\n1. first\n2. second\n- [ ] task\n  - [x] subtask\n> quoted\n> more'],
    ['links', 'see https://example.com/x_y and [the doc](https://example.com/d) or mail a_b@example.com'],
    ['a year that looks like a numbered item', '2026. great year'],
    ['plain notes from the free plan', 'Sam wants to lead the Q4 launch.\nAsked about the promo timeline.\n\nFollow-ups:\n- [ ] Intro to design lead'],
  ];
  for (const [name, text] of exact) {
    it(name, () => expect(reopen(text)).toBe(text));
  }

  it('random plain text survives a reopen unchanged', () => {
    const alphabet = ['a', 'b', ' ', ' ', '  ', '    ', '\t', '\n', '\n\n', '*', '**', '_', '~', '~~', '`', '[', ']', '(', ')', '#', '# ', '## ', '-', '- ', '* ', '1. ', '2) ', '> ', '>', '- [ ] ', '- [x] ', 'https://x.io/a', 'a@b.co', '[t](https://x.io)', 'x', '.', ':'];
    let seed = 42;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    const failures: string[] = [];
    for (let k = 0; k < 3000; k++) {
      let s = '';
      const len = 1 + rand(30);
      for (let j = 0; j < len; j++) s += alphabet[rand(alphabet.length)];
      const out = reopen(s);
      if (out !== s && reopen(out) !== out) failures.push(JSON.stringify(s));
      else if (out !== s && !acceptableNormalisation(s, out)) failures.push(`${JSON.stringify(s)} -> ${JSON.stringify(out)}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

/**
 * The only change allowed: where markers sit when the note renders identically,
 * e.g. "**[t](url)**" vs "[**t**](url)" (the same bold link).
 */
function acceptableNormalisation(before: string, after: string): boolean {
  return JSON.stringify(textToDoc(before)) === JSON.stringify(textToDoc(after));
}

describe('formatting the editor creates is saved and restored exactly', () => {
  const p = (...content: object[]) => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
  const t = (text: string, ...marks: string[]) => ({ type: 'text', text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });

  it('round-trips a document through text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [t('Budget')] },
        p(t('Decision:', 'bold'), t(' hire '), t('two', 'bold', 'italic')),
        p(),
        p(t('- not a list, just a dash')),
        p(t('    '), t('[10m]', 'bold'), t(' indented')),
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p(t('Send budget'))] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('[ ] literal brackets'))] }] },
        p(t('2 * 3 and a literal **star pair**')),
      ],
    } as unknown as Doc;
    const text = docToText(doc);
    expect(text).toContain('\\- not a list');
    expect(docToText(textToDoc(text))).toBe(text);
    expect(reopen(text)).toBe(text);
  });
});

describe('random documents from the editor save and reopen identically', () => {
  it('holds for 1500 generated documents', () => {
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    const pick = <T,>(xs: T[]) => xs[rand(xs.length)]!;
    const words = ['plan', ' ', '  ', '2 * 3', 'snake_case', '[x]', '**', '*', '~', '`', '- ', '# ', '1. ', '> ', 'https://x.io', 'ok', '    '];
    const markSets = [[], [], ['bold'], ['italic'], ['bold', 'italic'], ['strike'], ['code']];
    const inline = () => {
      const n = rand(4);
      const out: object[] = [];
      for (let k = 0; k < n; k++) {
        const marks = pick(markSets);
        let text = pick(words) + pick(words);
        if (marks.length && !text.trim()) text = 'w';
        out.push({ type: 'text', text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
      }
      return out;
    };
    const para = () => {
      const c = inline();
      return { type: 'paragraph', ...(c.length ? { content: c } : {}) };
    };
    const list = (depth: number): object => {
      const type = pick(['bulletList', 'orderedList', 'taskList']);
      const items = Array.from({ length: 1 + rand(3) }, () => {
        const content: object[] = [para()];
        if (depth < 2 && rand(4) === 0) content.push(list(depth + 1));
        return type === 'taskList' ? { type: 'taskItem', attrs: { checked: rand(2) === 1 }, content } : { type: 'listItem', content };
      });
      return { type, content: items };
    };
    const block = () => {
      const r = rand(10);
      if (r < 5) return para();
      if (r < 6) return { type: 'heading', attrs: { level: 1 + rand(2) }, content: inline() };
      if (r < 9) return list(0);
      return { type: 'blockquote', content: [para()] };
    };
    const failures: string[] = [];
    for (let k = 0; k < 1500; k++) {
      const doc = { type: 'doc', content: Array.from({ length: 1 + rand(5) }, block) };
      // Load the generated document into the real editor (it normalises like typing would)…
      const text = docToText(doc as Doc);
      const once = reopen(text);
      if (reopen(once) !== once) failures.push(`unstable: ${JSON.stringify(text)}`);
      const roundTrip = docToText(textToDoc(text));
      if (roundTrip !== text && !acceptableNormalisation(text, roundTrip)) failures.push(`${JSON.stringify(text)} -> ${JSON.stringify(roundTrip)}`);
      if (once !== text && !acceptableNormalisation(text, once)) failures.push(`editor: ${JSON.stringify(text)} -> ${JSON.stringify(once)}`);
      if (failures.length > 10) break;
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

describe('older notes saved as Markdown by 0.3.0', () => {
  it('open with their formatting, nothing dropped', () => {
    const legacy = '**\\[15m\\]** Brokerage\n\n    **\\[10m\\]** Overview and News\n\n- [ ] Send budget';
    const el = document.createElement('div');
    editor = createRichEditor(el, { text: legacy });
    const shown = el.textContent ?? '';
    expect(shown).toContain('[15m]');
    expect(shown).toContain('[10m] Overview and News');
    expect(shown).toContain('Send budget');
  });

  it('keeps HTML typed as text as text', () => {
    const out = reopen('hi <img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(out).toBe('hi <img src=x onerror="alert(1)"> <script>alert(2)</script>');
    expect(document.querySelector('script, img')).toBeNull();
  });
});

describe('sanitizePastedHTML', () => {
  it('removes executable and unsupported content but keeps formatting and safe links', () => {
    const out = sanitizePastedHTML(
      '<p onclick="x()">From <b>Docs</b><img src=x onerror="alert(1)"><script>alert(2)</script>' +
        '<a href="javascript:alert(3)">bad</a> <a href=\'data:text/html,x\'>data</a> <a href="https://ok.example/">good</a></p>',
    );
    expect(out).toBe('<p>From <b>Docs</b><a>bad</a> <a>data</a> <a href="https://ok.example/">good</a></p>');
  });
});
