import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  // Not '.output': dot-folders are hidden in Finder.
  outDir: 'dist',
  manifest: {
    name: 'Private Event Notes for Google Calendar',
    description: 'Private notes on your Google Calendar events. Never added to the event or shared with guests.',
    permissions: ['storage', 'unlimitedStorage', 'sidePanel'],
    action: { default_title: 'Private Event Notes' },
    // The Pro rich-text editor, loaded on demand by the calendar content script.
    web_accessible_resources: [{ resources: ['rich/editor.js'], matches: ['https://calendar.google.com/*'] }],
  },
  vite: () => ({
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  }),
});
