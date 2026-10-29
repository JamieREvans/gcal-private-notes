/**
 * How rich notes are stored: a faithful, line-based text format.
 *
 * Every line of the note is one line of text, exactly as typed: leading
 * spaces, blank lines and runs of blank lines are kept. Only a small set of
 * markers carries formatting, and they read naturally as plain text:
 *
 *   # Heading / ## Subheading
 *   - bullet      1. numbered      - [ ] task / - [x] done      > quote
 *   (two more spaces of indent per nested list level)
 *   **bold**  *italic*  ~~strike~~  `code`  [text](https://…)  bare URLs
 *
 * docToText and textToDoc are exact inverses for the editor's schema, so a
 * note always reopens as it was written. (Earlier versions used Markdown,
 * which collapses blank lines and treats indented lines as code.)
 */

export interface Mark {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'link';
  attrs?: { href: string };
}
export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}
export interface Block {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (Block | TextNode)[];
}
export interface Doc {
  type: 'doc';
  content: Block[];
}

type ListType = 'bulletList' | 'orderedList' | 'taskList';

// ─── Inline ────────────────────────────────────────────────────────────────

const MARK_ORDER: Mark['type'][] = ['link', 'bold', 'italic', 'strike', 'code'];
const DELIMS: Record<'bold' | 'italic' | 'strike' | 'code', string> = { bold: '**', italic: '*', strike: '~~', code: '`' };
const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const BARE_URL = /^https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"]/;
const BARE_EMAIL = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const ESCAPABLE = /[\\*~`[]/g;

const sameMark = (a: Mark, b: Mark) => a.type === b.type && (a.attrs?.href ?? '') === (b.attrs?.href ?? '');
const hasMark = (marks: Mark[], m: Mark) => marks.some((x) => sameMark(x, m));
const sortMarks = (marks: Mark[] = []) => [...marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

function openMark(m: Mark): string {
  return m.type === 'link' ? '[' : DELIMS[m.type];
}
function closeMark(m: Mark): string {
  return m.type === 'link' ? `](${m.attrs?.href ?? ''})` : DELIMS[m.type];
}

function serializeInlineRaw(nodes: TextNode[], escape: boolean): string {
  let out = '';
  const open: Mark[] = [];
  for (const node of mergeText(nodes)) {
    const marks = sortMarks(node.marks);
    // A link whose text is its own URL or email is written bare.
    const bareLink = marks.find((m) => m.type === 'link' && (m.attrs?.href === node.text || m.attrs?.href === `mailto:${node.text}`));
    const wanted = bareLink ? marks.filter((m) => m !== bareLink) : marks;
    // Close from the innermost open mark down to the first one this text doesn't continue.
    const keep = open.findIndex((m) => !hasMark(wanted, m));
    if (keep >= 0) while (open.length > keep) out += closeMark(open.pop()!);
    for (const m of wanted) {
      if (!hasMark(open, m)) {
        out += openMark(m);
        open.push(m);
      }
    }
    const inCode = open.some((m) => m.type === 'code');
    out += escape && !inCode && !bareLink ? node.text.replace(ESCAPABLE, '\\$&') : node.text;
  }
  while (open.length) out += closeMark(open.pop()!);
  return out;
}

/** Inline content → text. Escapes only when the literal text would otherwise read as formatting. */
export function serializeInline(nodes: TextNode[]): string {
  const literal = serializeInlineRaw(nodes, false);
  return sameInline(parseInline(literal), mergeText(nodes)) ? literal : serializeInlineRaw(nodes, true);
}

function mergeText(nodes: TextNode[]): TextNode[] {
  const out: TextNode[] = [];
  for (const n of nodes) {
    if (!n.text) continue;
    const prev = out[out.length - 1];
    const marks = sortMarks(n.marks);
    if (prev && sameMarks(sortMarks(prev.marks), marks)) prev.text += n.text;
    else out.push(marks.length ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text });
  }
  return out;
}
const sameMarks = (a: Mark[], b: Mark[]) => a.length === b.length && a.every((m, i) => sameMark(m, b[i]!));
const sameInline = (a: TextNode[], b: TextNode[]) =>
  a.length === b.length && a.every((n, i) => n.text === b[i]!.text && sameMarks(sortMarks(n.marks), sortMarks(b[i]!.marks)));

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * Text → inline content. A delimiter opens formatting only when it hugs
 * non-space text and its partner exists on the line; it then closes at exactly
 * that partner, so parsing is deterministic and serializing gives the text back.
 */
export function parseInline(text: string): TextNode[] {
  const out: TextNode[] = [];
  const active: { mark: Mark; closeAt: number; width: number }[] = [];
  let codeClosedAt = -2;
  // ProseMirror merges touching links to the same URL, so a link can't start right where an identical one ended.
  let lastLink = { end: -1, href: '' };
  let buf = '';
  const marksNow = () => sortMarks(active.map((a) => ({ ...a.mark })));
  const flush = () => {
    if (!buf) return;
    const marks = marksNow();
    out.push(marks.length ? { type: 'text', text: buf, marks } : { type: 'text', text: buf });
    buf = '';
  };
  const isActive = (t: Mark['type']) => active.some((a) => a.mark.type === t);

  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    const rest = text.slice(i);

    // Close whatever was paired to end here (innermost first).
    const closing = active.findIndex((a) => a.closeAt === i);
    if (closing >= 0) {
      flush();
      const { width, mark } = active.splice(closing, 1)[0]!;
      if (mark.type === 'code') codeClosedAt = i;
      i += width;
      continue;
    }
    if (isActive('code')) {
      buf += c;
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < text.length && /[\\*~`[\]]/.test(text[i + 1]!)) {
      buf += text[i + 1];
      i += 2;
      continue;
    }
    if (c === '`' && codeClosedAt !== i - 1) {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        active.push({ mark: { type: 'code' }, closeAt: end, width: 1 });
        i++;
        continue;
      }
    }
    // [text](url)
    if (c === '[' && !isActive('link')) {
      const m = /^\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/.exec(rest);
      const fits = m && active.every((x) => x.closeAt >= i + m[0].length);
      if (m && fits && SAFE_URL.test(m[2]!) && !(lastLink.end === i && lastLink.href === m[2])) {
        flush();
        lastLink = { end: i + m[0].length, href: m[2]! };
        const link: Mark = { type: 'link', attrs: { href: m[2]! } };
        for (const n of parseInline(m[1]!)) {
          out.push({ ...n, marks: sortMarks([...(n.marks ?? []), ...marksNow(), link]) });
        }
        i += m[0].length;
        continue;
      }
    }
    // Bare URLs and email addresses
    if (!isActive('link') && (i === 0 || isSpace(text[i - 1]) || /[(*~]/.test(text[i - 1]!))) {
      const url = c === 'h' ? BARE_URL.exec(rest) : null;
      const email = url ? null : BARE_EMAIL.exec(rest);
      const m = url ?? email;
      if (m && !active.some((a) => a.closeAt < i + m[0].length)) {
        flush();
        const href = url ? m[0] : `mailto:${m[0]}`;
        out.push({ type: 'text', text: m[0], marks: sortMarks([...marksNow(), { type: 'link', attrs: { href } }]) });
        i += m[0].length;
        continue;
      }
    }
    // **bold**, ~~strike~~, *italic*
    const delim = rest.startsWith('**') ? 'bold' : rest.startsWith('~~') ? 'strike' : c === '*' ? 'italic' : null;
    if (delim) {
      const d = DELIMS[delim];
      if (!isActive(delim)) {
        // Must close inside every enclosing span, so formatting nests rather than overlaps.
        const limit = Math.min(text.length, ...active.map((a) => a.closeAt));
        const close = isSpace(text[i + d.length]) ? -1 : findCloser(text, i + d.length, d, limit);
        if (close > i + d.length) {
          flush();
          active.push({ mark: { type: delim }, closeAt: close, width: d.length });
          i += d.length;
          continue;
        }
      }
      // Not formatting: keep the whole run of this character as text.
      let run = 0;
      while (text[i + run] === c && !active.some((a) => a.closeAt === i + run)) run++;
      buf += text.slice(i, i + Math.max(run, 1));
      i += Math.max(run, 1);
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/**
 * Where a delimiter opened at `from` closes. Runs of the same character are
 * read as a unit: "**" closes on a run's last two characters and "*" on its
 * first (so "***x***" is bold+italic), and a run of exactly two never closes "*".
 */
function findCloser(text: string, from: number, d: string, limit: number): number {
  const ch = d[0]!;
  for (let j = from; j < limit; j++) {
    if (text[j] === '\\') {
      j++;
      continue;
    }
    if (text[j] === '`') {
      const end = text.indexOf('`', j + 1);
      if (end > j + 1 && end < limit) {
        j = end;
        continue;
      }
    }
    if (text[j] !== ch) continue;
    let run = 1;
    while (text[j + run] === ch) run++;
    if (!isSpace(text[j - 1])) {
      if (d.length === 2 && run >= 2 && j + run - 2 >= from && j + run <= limit) return j + run - 2;
      if (d.length === 1 && run !== 2 && j + 1 <= limit) return j;
    }
    j += run - 1;
  }
  return -1;
}

// ─── Blocks ────────────────────────────────────────────────────────────────

const BLOCK_START = /^(#{1,2} |- |\d+\. |> )/;

function inlineOf(block: Block | undefined): TextNode[] {
  return ((block?.content ?? []) as TextNode[]).filter((n) => n.type === 'text');
}

const LIST_START = /^(- |\d+\. )/;
const isList = (b: Block | undefined) => b?.type === 'bulletList' || b?.type === 'orderedList' || b?.type === 'taskList';

/** Depth of the last item in a list (0 = top level), i.e. how deep the next line could nest. */
function lastItemDepth(list: Block): number {
  const item = list.content?.[list.content.length - 1] as Block | undefined;
  const nested = (item?.content as Block[] | undefined)?.filter(isList).pop();
  return nested ? 1 + lastItemDepth(nested) : 0;
}

function paragraphText(block: Block, prev: Block | undefined): string {
  const text = serializeInline(inlineOf(block));
  // Keep a literal "- ", "# ", "1. " or "> " from being read as formatting. Indented
  // lines are only read as list items right after a list, so only escape those there.
  const m = /^( *)(.*)$/s.exec(text)!;
  const escape = m[1]
    ? isList(prev) && LIST_START.test(m[2]!) && m[1].length % 2 === 0 && m[1].length <= 2 * (lastItemDepth(prev!) + 1)
    : BLOCK_START.test(m[2]!);
  return escape ? `${m[1]}\\${m[2]}` : text;
}

function listLines(list: Block, indent: string, out: string[]) {
  const type = list.type as ListType;
  let n = Number((list.attrs?.start as number | undefined) ?? 1);
  for (const item of list.content ?? []) {
    const children = ((item as Block).content ?? []) as Block[];
    for (const child of children) {
      if (child.type === 'paragraph') {
        const marker =
          type === 'taskList' ? `- [${(item as Block).attrs?.checked ? 'x' : ' '}] ` : type === 'orderedList' ? `${n++}. ` : '- ';
        let text = serializeInline(inlineOf(child));
        // A bullet whose text starts with "[ ]" would read back as a task.
        if (type !== 'taskList' && /^\[[ xX]\]/.test(text)) text = `\\${text}`;
        // Extra paragraphs in one item are written as further items.
        out.push(indent + marker + text);
      } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
        listLines(child, indent + '  ', out);
      }
    }
  }
}

export function docToText(doc: Doc): string {
  const out: string[] = [];
  let prev: Block | undefined;
  for (const block of doc.content ?? []) {
    const before = prev;
    prev = block;
    switch (block.type) {
      case 'heading':
        out.push(`${'#'.repeat(Number(block.attrs?.level ?? 1))} ${serializeInline(inlineOf(block))}`);
        break;
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        listLines(block, '', out);
        break;
      case 'blockquote':
        for (const p of (block.content ?? []) as Block[]) out.push(`> ${serializeInline(inlineOf(p))}`);
        break;
      default:
        out.push(paragraphText(block, before));
    }
  }
  return out.join('\n');
}

// Only the forms we write: "- ", "- [ ] ", "- [x] " and "N. ". Others ("* ", "2) ") stay as typed text.
const LIST_ITEM = /^( *)(?:(-) \[([ xX])\] ?|(-) |(\d+)\. )(.*)$/;

export function textToDoc(text: string): Doc {
  const content: Block[] = [];
  // Open lists, outermost first, with the indent their markers sit at.
  let stack: { indent: number; list: Block }[] = [];
  const para = (t: string): Block => {
    const inline = parseInline(t);
    return inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' };
  };

  for (const line of text.split('\n')) {
    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = item[1]!.length;
      const type: ListType = item[3] !== undefined ? 'taskList' : item[5] !== undefined ? 'orderedList' : 'bulletList';
      const node: Block =
        type === 'taskList'
          ? { type: 'taskItem', attrs: { checked: item[3] !== ' ' }, content: [para(item[6]!)] }
          : { type: 'listItem', content: [para(item[6]!)] };

      // Indented markers are list items only at the indents we write: an open level, or
      // two spaces deeper than the innermost one. Anything else is an indented line of text.
      const deepest = stack.length ? stack[stack.length - 1]!.indent : -2;
      if (indent > 0 && !(stack.some((s) => s.indent === indent) || indent === deepest + 2)) {
        stack = [];
        content.push(para(line));
        continue;
      }
      while (stack.length && stack[stack.length - 1]!.indent > indent) stack.pop();
      const top = stack[stack.length - 1];
      if (top && top.indent === indent && top.list.type === type) {
        top.list.content!.push(node);
        continue;
      }
      if (top && top.indent === indent) stack.pop(); // same level, different list type: start a sibling list
      const list: Block = { type, content: [node] };
      if (type === 'orderedList' && item[5] !== '1') list.attrs = { start: Number(item[5]) };
      const parent = stack[stack.length - 1];
      if (parent && parent.indent < indent) {
        const lastItem = parent.list.content![parent.list.content!.length - 1] as Block;
        lastItem.content!.push(list);
      } else {
        stack = [];
        content.push(list);
      }
      stack.push({ indent, list });
      continue;
    }

    stack = [];
    const heading = /^(#{1,2}) (.*)$/.exec(line);
    if (heading) {
      const inline = parseInline(heading[2]!);
      content.push({ type: 'heading', attrs: { level: heading[1]!.length }, ...(inline.length ? { content: inline } : {}) });
      continue;
    }
    const quote = /^> (.*)$/.exec(line);
    if (quote) {
      const prev = content[content.length - 1];
      if (prev?.type === 'blockquote') prev.content!.push(para(quote[1]!));
      else content.push({ type: 'blockquote', content: [para(quote[1]!)] });
      continue;
    }
    // A backslash before a block marker means it was literal text.
    const escaped = /^( *)\\(?=#{1,2} |- |\d+\. |> )/.exec(line);
    content.push(para(escaped ? escaped[1]! + line.slice(escaped[0].length) : line));
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
