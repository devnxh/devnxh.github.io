import type { ImageMetadata } from 'astro';
import type { Attachment } from './obsidian/vault';

// Every raster image in the vault, importable on demand through Astro's image pipeline.
const modules = import.meta.glob<{ default: ImageMetadata }>('/vault/**/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG}');

/** Loads an attachment so it can be passed to `<Image />`. Undefined when the file is not an image. */
export async function loadImage(attachment: Attachment | undefined): Promise<ImageMetadata | undefined> {
  if (!attachment) return undefined;
  const loader = modules[`/vault/${attachment.file}`];
  return loader ? (await loader()).default : undefined;
}
