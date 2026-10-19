// Renders assets/icon.svg to the PNG sizes the manifest and store need.
// The 128px icon gets 16px transparent padding, as the Chrome Web Store asks.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('public/icon', { recursive: true });
const render = (size) => sharp('assets/icon.svg', { density: 384 }).resize(size, size);
for (const size of [16, 32, 48]) await render(size).png().toFile(`public/icon/${size}.png`);
await render(96)
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('public/icon/128.png');
console.log('Wrote public/icon/{16,32,48,128}.png');
