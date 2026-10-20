import { afterEach, describe, expect, it } from 'vitest';
import { createRichEditor, sanitizePastedHTML, type RichEditor } from '../editor/rich-editor';

let editor: RichEditor | undefined;
afterEach(() => editor?.destroy());

function roundTrip(markdown: string): string {
  const el = document.createElement('div');
  document.body.append(el);
  editor = createRichEditor(el, { markdown });
  return editor.getMarkdown();
}

describe('rich editor markdown round-trip', () => {
  const cases: [string, string][] = [
    ['plain lines keep their line breaks', 'Sam wants to lead the Q4 launch.\nAsked about the promo timeline.'],
    ['paragraphs', 'First thought.\n\nSecond thought.'],
    ['checklists stay "- [ ]"', '- [ ] Intro to design lead\n- [x] Send deck'],
    ['bullets', '- one\n- two'],
    ['headings and marks', '# Agenda\n\n**Decisions** and *ideas* and ~~dropped~~'],
    ['links', 'See [the doc](https://example.com/doc)'],
    ['everyday punctuation', 'Q4 planning: 1:1 with Sam (re: promo) - follow up #hiring 50% done'],
  ];
  for (const [name, md] of cases) {
    it(name, () => expect(roundTrip(md)).toBe(md));
  }

  const normalised: [string, string, string][] = [
    ['comparison and ampersand characters stay as typed', 'a < b > c & d', 'a < b > c & d'],
    ['bare URLs stay bare', 'see https://example.com/x_y', 'see https://example.com/x_y'],
    ['bare emails stay bare', 'email a_b@example.com', 'email a_b@example.com'],
    ['quotes keep their marker', '> quoted', '> quoted'],
    ['inline code survives', 'run `npm test` first', 'run `npm test` first'],
    ['inline HTML is read as Markdown formatting', 'use <b>tags</b> carefully', 'use **tags** carefully'],
  ];
  for (const [name, md, expected] of normalised) {
    it(name, () => expect(roundTrip(md)).toBe(expected));
  }

  it('drops anything executable from HTML inside a note', () => {
    const out = roundTrip('hi <img src=x onerror="alert(1)"><script>alert(2)</script> <a href="javascript:alert(3)">x</a>');
    expect(out).not.toMatch(/onerror|<script|javascript:/i);
    expect(document.querySelector('script')).toBeNull();
  });

  it('is stable: a second save changes nothing', () => {
    const once = roundTrip('Plan: a < b & c\n- [ ] ping https://example.com\n\n**bold** 2 * 3');
    expect(roundTrip(once)).toBe(once);
  });

  it('a list right after a line becomes its own block (still parsed by follow-ups)', () => {
    expect(roundTrip('Follow-ups:\n- [ ] Intro')).toBe('Follow-ups:\n\n- [ ] Intro');
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
