import { browser } from 'wxt/browser';
import type * as RichEditorModule from '../editor/rich-editor';

let loading: Promise<typeof RichEditorModule> | null = null;

/** Loads the rich-text editor module once, on first use. */
export function loadRichEditor(): Promise<typeof RichEditorModule> {
  const url = (browser.runtime.getURL as (path: string) => string)('/rich/editor.js');
  loading ??= import(/* @vite-ignore */ url).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}
