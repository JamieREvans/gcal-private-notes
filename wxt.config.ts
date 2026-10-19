import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  // Not '.output': dot-folders are hidden in Finder.
  outDir: 'dist',
  manifest: {
    name: 'Event Notes for Google Calendar',
    short_name: 'Event Notes',
    description: 'Private notes on your Google Calendar events, stored only in your browser.',
    permissions: ['storage', 'unlimitedStorage', 'sidePanel'],
    action: { default_title: 'Event Notes' },
  },
  vite: () => ({
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  }),
});
