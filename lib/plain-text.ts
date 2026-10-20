/** Markdown → readable plain text, for previews and lists. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/^(\s*)[-*]\s+\[ \]\s?/gm, '$1☐ ')
    .replace(/^(\s*)[-*]\s+\[[xX]\]\s?/gm, '$1☑ ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?=[^\w*]|$)/gm, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
