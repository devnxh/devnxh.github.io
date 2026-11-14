/**
 * Draws the "DV" monogram favicon in code and writes the three files the site
 * links to. Run once, or again after changing the design:
 *
 *   node scripts/generate-icons.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

const ink = '#1C1A16';
const paper = '#F3EFE6';
const accent = '#B4321E';

const font = readFileSync('node_modules/@fontsource/newsreader/files/newsreader-latin-600-normal.woff');

const monogram = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 512,
      height: 512,
      backgroundColor: ink,
      color: paper,
      fontFamily: 'Newsreader',
    },
    children: [
      { type: 'div', props: { style: { display: 'flex', fontSize: 300, lineHeight: 1, letterSpacing: -16, marginTop: -24 }, children: 'DV' } },
      // The red-pen underline, the one accent the site allows itself.
      { type: 'div', props: { style: { display: 'flex', width: 300, height: 22, backgroundColor: accent, marginTop: 4 } } },
    ],
  },
};

const svg = await satori(monogram as never, {
  width: 512,
  height: 512,
  fonts: [{ name: 'Newsreader', data: font, weight: 600, style: 'normal' }],
});

mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', svg);
await sharp(Buffer.from(svg)).resize(32, 32).png().toFile('public/favicon-32.png');
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Wrote public/favicon.svg, public/favicon-32.png and public/apple-touch-icon.png');
