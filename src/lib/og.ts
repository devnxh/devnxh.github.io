/**
 * Draws the 1200×630 share image for a page with the site's own fonts and
 * palette. Satori lays the text out as SVG; sharp turns it into a PNG.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { site } from '../site.config';

const fontFile = (pkg: string, file: string): Buffer =>
  readFileSync(join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file));

// Latin Extended is loaded as a second face of the same family, so German titles render.
const fonts = [
  { name: 'Newsreader', weight: 500 as const, data: fontFile('newsreader', 'newsreader-latin-500-normal.woff') },
  { name: 'Newsreader', weight: 500 as const, data: fontFile('newsreader', 'newsreader-latin-ext-500-normal.woff') },
  { name: 'IBM Plex Mono', weight: 400 as const, data: fontFile('ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff') },
  { name: 'IBM Plex Mono', weight: 400 as const, data: fontFile('ibm-plex-mono', 'ibm-plex-mono-latin-ext-400-normal.woff') },
].map((font) => ({ ...font, style: 'normal' as const }));

const paper = '#F3EFE6';
const ink = '#1C1A16';
const muted = '#5A554C';
const faint = '#8A8476';
const rule = '#D6CEBD';
const accent = '#B4321E';

type Child = Element | string;
interface Element {
  type: string;
  props: { style?: Record<string, string | number>; children?: Child | Child[] };
}
const box = (style: Record<string, string | number>, children?: Child | Child[]): Element => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

export interface OgCard {
  /** Small mono line above the title, for example `CASE-007 · tryhackme`. */
  kicker: string;
  title: string;
}

export async function renderOgImage({ kicker, title }: OgCard): Promise<Buffer> {
  const size = title.length > 60 ? 56 : title.length > 34 ? 68 : 84;
  const tree = box(
    { width: 1200, height: 630, backgroundColor: paper, color: ink, fontFamily: 'Newsreader' },
    [
      // The margin column with its red-pen rule.
      box(
        { width: 150, height: 630, borderRight: `2px solid ${accent}`, paddingTop: 72, paddingLeft: 48, fontFamily: 'IBM Plex Mono', fontSize: 20, color: faint },
        '0x0000',
      ),
      box({ flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '64px 72px 56px 56px' }, [
        box({ flexDirection: 'column' }, [
          box({ fontFamily: 'IBM Plex Mono', fontSize: 24, letterSpacing: 2, color: muted, textTransform: 'uppercase' }, kicker),
          box({ marginTop: 28, fontSize: size, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 900 }, title),
        ]),
        box({ flexDirection: 'column' }, [
          box({ fontFamily: 'IBM Plex Mono', fontSize: 18, color: faint, borderTop: `1px solid ${rule}`, paddingTop: 20 }, '4D 5A 90 00 03 00 00 00 04 00 00 00 FF FF 00 00  MZ..............'),
          box({ marginTop: 20, justifyContent: 'space-between', alignItems: 'baseline' }, [
            box({ fontSize: 34 }, site.name),
            box({ fontFamily: 'IBM Plex Mono', fontSize: 22, color: muted }, site.url.replace(/^https?:\/\//, '')),
          ]),
        ]),
      ]),
    ],
  );

  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
