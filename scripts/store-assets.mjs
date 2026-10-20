// Builds Chrome Web Store graphics in store/ from the e2e screenshots.
// Usage: npm run build && npm run e2e -- --screenshots && npm run store-assets
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

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

// Screenshots 1–4 are stills of the real extension from the demo recording.
const stills = [
  ['demo-3', 'screenshot-1-notes.png'],
  ['demo-4', 'screenshot-2-private.png'],
  ['demo-6', 'screenshot-3-today.png'],
  ['demo-7', 'screenshot-4-followups.png'],
];
for (const [from, to] of stills) {
  await sharp(`store/screenshots/${from}.png`).resize(1280, 800).png().toFile(`store/${to}`);
  console.log('wrote', `store/${to}`);
}

await screenshot('store/screenshot-5-pro.png', {
  headline: ['Free for 5 notes.', 'Pro from $1.'],
  sub: ['A one-off “buy me a coffee” that', 'supports an independent developer.', 'No subscription, no tracking.'],
  image: 'store/screenshots/raw-settings.png',
  crop: { left: 350, top: 0, width: 580, height: 490 },
  scale: 1.18,
});

// The store also accepts 640×400; same images, smaller.
await mkdir('store/640x400', { recursive: true });
for (const name of [...stills.map(([, to]) => to), 'screenshot-5-pro.png']) {
  await sharp(`store/${name}`).resize(640, 400).png().toFile(`store/640x400/${name}`);
}
console.log('wrote store/640x400/*');

// Marquee promo tile, 1400×560.
{
  const crop = await sharp('store/screenshots/demo-3.png')
    .extract({ left: 322, top: 150, width: 448, height: 386 })
    .resize(Math.round(448 * 1.12), Math.round(386 * 1.12))
    .png()
    .toBuffer();
  const { width: w, height: h } = await sharp(crop).metadata();
  await sharp(
    canvas(
      1400,
      560,
      `<g transform="translate(96 120) scale(0.75)">${iconInner}</g>` +
        textBlock(96, 300, ['Private Event Notes'], 60, INK, 700) +
        textBlock(96, 350, ['for Google Calendar'], 32, MUTED, 500) +
        textBlock(96, 430, ['A private sticky note on every event.', 'Only visible to you. No account needed.'], 26, INK, 400, 1.4),
    ),
  )
    .composite([{ input: await roundCorners(crop, w, h, 24), left: 1400 - w - 110, top: Math.round((560 - h) / 2) }])
    .png()
    .toFile('store/promo-marquee-1400x560.png');
  console.log('wrote store/promo-marquee-1400x560.png');
}

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
