import { defineConfig } from 'vite';

// Builds the Pro rich-text editor as a standalone ES module that the extension
// loads on demand (lib/load-editor.ts). Output lands in public/, which WXT copies.
export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: { entry: 'editor/rich-editor.ts', formats: ['es'], fileName: () => 'editor.js' },
    outDir: 'public/rich',
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    target: 'chrome120',
    rolldownOptions: { output: { minify: true } },
  },
});
