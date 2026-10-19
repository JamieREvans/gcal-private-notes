// Builds Chrome Web Store graphics in store/ from the e2e screenshots.
// Usage: npm run build && npm run e2e -- --screenshots && npm run store-assets
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const BG = '#fff6df';
const INK = '#2b2616';
const MUTED = '#7a6a40';
const icon = await readFile('assets/icon.svg', 'utf8');
const iconInner = icon.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function textBlock(x, y, lines, size, color, weight = 400, gap = 1.25) {
  return lines
    .map((l, i) => `<text x="${x}" y="${y + i * size * gap}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(l)}</text>`)
    .join('');
}

function canvas(width, height, inner) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${BG}"/>${inner}</svg>`,
  );
}

async function screenshot(out, { headline, sub, image, crop, scale }) {
  let img = sharp(image);
  if (crop) img = img.extract(crop);
  const meta = await img.toBuffer({ resolveWithObject: true });
  const w = Math.round(meta.info.width * scale);
  const h = Math.round(meta.info.height * scale);
  const shot = await sharp(meta.data).resize(w, h).png().toBuffer();
  const left = 1280 - w - 60;
  const top = Math.round((800 - h) / 2);
  const bg = canvas(
    1280,
    800,
    `<g transform="translate(64 96) scale(0.5)">${iconInner}</g>` +
      textBlock(64, 210, headline, 46, INK, 700, 1.2) +
      textBlock(64, 210 + headline.length * 56 + 24, sub, 22, MUTED, 400, 1.45) +
      `<rect x="${left - 2}" y="${top - 2}" width="${w + 4}" height="${h + 4}" rx="18" fill="#000" opacity="0.08"/>`,
  );
  await sharp(bg)
    .composite([{ input: await roundCorners(shot, w, h, 16), left, top }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function roundCorners(buf, w, h, r) {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

await screenshot('store/screenshot-1-popup.png', {
  headline: ['Private notes,', 'right in your', 'calendar'],
  sub: ['Click any event and jot it down.', 'Only visible to you: never added', 'to the event or shared with guests.'],
  image: 'store/screenshots/raw-popup.png',
  crop: { left: 300, top: 120, width: 448, height: 358 },
  scale: 1.45,
});

await screenshot('store/screenshot-2-sidepanel.png', {
  headline: ['Every note,', 'one search away'],
  sub: ['Search all your notes in the side panel.', 'Recurring meetings keep their history,', 'so your 1:1s build on each other.'],
  image: 'store/screenshots/raw-sidepanel.png',
  crop: { left: 0, top: 0, width: 400, height: 470 },
  scale: 1.45,
});

await screenshot('store/screenshot-3-settings.png', {
  headline: ['Free for 5 notes.', 'Pro from $1.'],
  sub: ['A one-off “buy me a coffee” that', 'supports an independent developer.', 'No subscription, no tracking.'],
  image: 'store/screenshots/raw-settings.png',
  crop: { left: 350, top: 0, width: 580, height: 420 },
  scale: 1.2,
});

// Small promo tile, 440×280.
await sharp(
  canvas(
    440,
    280,
    `<g transform="translate(32 40) scale(0.62)">${iconInner}</g>` +
      textBlock(32, 158, ['Private Event Notes'], 30, INK, 700) +
      textBlock(32, 190, ['for Google Calendar'], 20, MUTED, 500) +
      textBlock(32, 236, ['Notes on your events. Only visible to you.'], 16, INK, 400),
  ),
)
  .png()
  .toFile('store/promo-small-440x280.png');
console.log('wrote store/promo-small-440x280.png');
