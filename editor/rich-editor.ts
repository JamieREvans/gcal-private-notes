/**
 * The Pro rich-text editor: TipTap (ProseMirror) that reads and writes
 * Markdown, so notes stay plain-text Markdown in storage and every other
 * feature (follow-ups, search, export, sync) keeps working on the text.
 *
 * Built separately as an ES module (dist/.../rich/editor.js) and loaded on
 * demand, so free users and pages without a notes box never load it.
 */
import { Editor, type Extensions } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import { BulletList, ListItem, ListKeymap, OrderedList, TaskItem, TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';

export type RichCommand = 'h1' | 'h2' | 'bold' | 'italic' | 'strike' | 'bullet' | 'ordered' | 'task' | 'link';

export interface RichEditorOptions {
  markdown: string;
  placeholder?: string;
  ariaLabel?: string;
  editable?: boolean;
  onChange?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Selection or formatting changed (to refresh toolbar state). */
  onState?: () => void;
}

export interface RichEditor {
  getMarkdown(): string;
  /** Replaces the content without firing onChange. */
  setMarkdown(markdown: string): void;
  setEditable(editable: boolean): void;
  focus(): void;
  run(command: RichCommand): void;
  isActive(command: RichCommand): boolean;
  destroy(): void;
}

const SAFE_LINK = /^(https?:|mailto:)/i;

export function extensions(placeholder = ''): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Bold,
    Italic,
    Strike,
    Code,
    Blockquote,
    Heading.configure({ levels: [1, 2] }),
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItem.configure({ nested: true }),
    ListKeymap,
    Link.configure({
      openOnClick: true,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => SAFE_LINK.test(url),
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    UndoRedo,
    Placeholder.configure({ placeholder }),
    // breaks: a single newline is a line break, matching how plain-text notes were written.
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
  ];
}

/**
 * Defence in depth for pasted HTML: drop elements we never render and anything
 * executable before ProseMirror parses it. (Its parser uses an inert document,
 * and Calendar's CSP blocks inline handlers anyway; this keeps it that way.)
 */
export function sanitizePastedHTML(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|template|noscript|img|picture|source|video|audio|svg|math|link|meta|base|input|form|button|textarea|select)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*'|(?:javascript|data|vbscript):[^\s>]*)/gi, '');
}

const unescapeMd = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');

/**
 * Markdown out of TipTap, normalised to read like the plain text people typed:
 * - hard breaks become a bare newline (not "\" or two trailing spaces);
 * - HTML entities the serializer adds (&lt; &gt; &amp;) go back to characters,
 *   except where that would form a tag, entity or quote;
 * - autolinked URLs and emails go back to bare text (they re-link on load);
 * - no trailing whitespace or runs of blank lines.
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/g, (all, text: string, href: string) => {
      const plain = unescapeMd(text);
      return plain === href || `mailto:${plain}` === href ? href.replace(/^mailto:/, '') : all;
    })
    .replace(/&amp;(?!#?\w+;)/g, '&')
    .replace(/&lt;(?![A-Za-z/!?])/g, '<')
    .replace(/^(\s*)&gt;/gm, '$1\u0000')
    .replace(/&gt;/g, '>')
    .replace(/\u0000/g, '&gt;')
    .replace(/(?: {2,}|\\)\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createRichEditor(element: HTMLElement, options: RichEditorOptions): RichEditor {
  const editor = new Editor({
    element,
    extensions: extensions(options.placeholder),
    content: options.markdown,
    contentType: 'markdown',
    editable: options.editable ?? true,
    // Styles live in our shadow root (components/styles.ts), not the page's <head>.
    injectCSS: false,
    editorProps: {
      transformPastedHTML: sanitizePastedHTML,
      attributes: {
        class: 'en-rich-content',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(options.ariaLabel ? { 'aria-label': options.ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => options.onChange?.(normalizeMarkdown(e.getMarkdown())),
    onFocus: () => options.onFocus?.(),
    onBlur: () => options.onBlur?.(),
    onTransaction: () => options.onState?.(),
  });

  const chain = () => editor.chain().focus();
  const commands: Record<RichCommand, () => void> = {
    h1: () => chain().toggleHeading({ level: 1 }).run(),
    h2: () => chain().toggleHeading({ level: 2 }).run(),
    bold: () => chain().toggleBold().run(),
    italic: () => chain().toggleItalic().run(),
    strike: () => chain().toggleStrike().run(),
    bullet: () => chain().toggleBulletList().run(),
    ordered: () => chain().toggleOrderedList().run(),
    task: () => chain().toggleTaskList().run(),
    link: () => {
      if (editor.isActive('link')) {
        chain().extendMarkRange('link').unsetLink().run();
        return;
      }
      const url = window.prompt('Link address (https://…)')?.trim();
      if (!url) return;
      const href = /^[a-z]+:/i.test(url) ? url : `https://${url}`;
      if (!SAFE_LINK.test(href)) return;
      if (editor.state.selection.empty) {
        chain().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href } }] }).run();
      } else {
        chain().extendMarkRange('link').setLink({ href }).run();
      }
    },
  };

  const active: Record<RichCommand, () => boolean> = {
    h1: () => editor.isActive('heading', { level: 1 }),
    h2: () => editor.isActive('heading', { level: 2 }),
    bold: () => editor.isActive('bold'),
    italic: () => editor.isActive('italic'),
    strike: () => editor.isActive('strike'),
    bullet: () => editor.isActive('bulletList'),
    ordered: () => editor.isActive('orderedList'),
    task: () => editor.isActive('taskList'),
    link: () => editor.isActive('link'),
  };

  return {
    getMarkdown: () => normalizeMarkdown(editor.getMarkdown()),
    setMarkdown: (markdown) => editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false }),
    setEditable: (editable) => editor.setEditable(editable, false),
    focus: () => editor.commands.focus('end'),
    run: (command) => commands[command](),
    isActive: (command) => active[command](),
    destroy: () => editor.destroy(),
  };
}
