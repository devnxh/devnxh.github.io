/**
 * Turns the raw AI photographs in `assets-src/higgsfield/` into the files the
 * site uses. Run it after adding or replacing an image:
 *
 *   npm run images
 *
 * For each `cover-*.png` it writes a greyscale, gently contrast-curved copy to
 * `vault/attachments/`, where a project's `cover: "[[cover-name.png]]"` finds
 * it. Astro then produces the responsive AVIF and WebP sizes at build time,
 * and CSS tints the greyscale image per theme.
 *
 * `og-background.png` is cropped to 2400×1256 and written to `src/assets/`.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const source = 'assets-src/higgsfield';
const covers = 'vault/attachments';
const assets = 'src/assets';

if (!existsSync(source)) {
  console.log(`Nothing to do: ${source}/ does not exist.`);
  process.exit(0);
}

const files = readdirSync(source).filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
if (files.length === 0) {
  console.log(`Nothing to do: put the raw images in ${source}/ first.`);
  process.exit(0);
}

mkdirSync(covers, { recursive: true });
mkdirSync(assets, { recursive: true });

for (const name of files) {
  const input = join(source, name);
  const base = name.replace(/\.[^.]+$/, '');
  // Greyscale with a soft S-curve: slightly deeper shadows, highlights kept.
  const image = sharp(input).greyscale().linear(1.08, -8).gamma(1.05);

  if (base === 'og-background') {
    await image.resize(2400, 1256, { fit: 'cover', position: 'left' }).png().toFile(join(assets, 'og-background.png'));
    console.log(`og-background → ${assets}/og-background.png (2400×1256)`);
    continue;
  }

  const { width = 0 } = await sharp(input).metadata();
  if (width < 2400) console.warn(`  ${name} is ${width}px wide; the brief asks for at least 2400px. Upscale it if you can.`);
  await image.resize({ width: 2400, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(join(covers, `${base}.png`));
  console.log(`${name} → ${covers}/${base}.png`);
}

console.log('\nDone. Set `cover: "[[cover-name.png]]"` in the project note to use an image.');
