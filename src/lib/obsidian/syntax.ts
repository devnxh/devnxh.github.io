/**
 * Pure string helpers for Obsidian syntax. No tree code lives here, so the
 * same functions serve the vault index, the remark plugins and the tests.
 */
import GithubSlugger, { slug as githubSlug } from 'github-slugger';

export interface WikiLink {
  /** The full matched text, for example `![[Note#Heading|alias]]`. */
  raw: string;
  start: number;
  end: number;
  /** True for `![[...]]`. */
  embed: boolean;
  /** The part before `#` and `|`. Empty for same-note links such as `[[#Heading]]`. */
  path: string;
  heading?: string;
  block?: string;
  alias?: string;
}

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;

export function findWikilinks(text: string): WikiLink[] {
  const found: WikiLink[] = [];
  for (const match of text.matchAll(WIKILINK)) {
    const inner = match[2] ?? '';
    const pipe = inner.indexOf('|');
    const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined;
    const hash = target.indexOf('#');
    const link: WikiLink = {
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
      embed: match[1] === '!',
      path: (hash === -1 ? target : target.slice(0, hash)).trim(),
      alias,
    };
    if (hash !== -1) {
      // `[[Note#H1#H2]]` points at the innermost heading.
      const fragment = (target.slice(hash + 1).split('#').pop() ?? '').trim();
      if (fragment.startsWith('^')) link.block = fragment.slice(1).trim();
      else if (fragment) link.heading = fragment;
    }
    found.push(link);
  }
  return found;
}

export interface TagMatch {
  /** Lower-cased tag without `#`, for example `windows/smb`. */
  tag: string;
  /** The tag as written, without `#`. */
  text: string;
  start: number;
  end: number;
}

// Obsidian: a tag follows whitespace or the start of a line, may contain letters,
// digits, `_`, `-` and `/`, and needs at least one non-numeric character.
const TAG = /(?<=^|[\s("'“‘])#([\p{L}\p{N}_/-]+)/gu;

export function findTags(text: string): TagMatch[] {
  const found: TagMatch[] = [];
  for (const match of text.matchAll(TAG)) {
    const written = (match[1] ?? '').replace(/\/+$/, '');
    if (!written || !/[^\d/]/.test(written)) continue;
    found.push({
      tag: normaliseTag(written),
      text: written,
      start: match.index,
      end: match.index + 1 + written.length,
    });
  }
  return found;
}

export function normaliseTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/** `^block-id` at the very end of a block. */
export const BLOCK_ID = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/;

/** A lookup key: case-insensitive, forward slashes, no `.md`. */
export function linkKey(value: string): string {
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\.md$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** The slug used in URLs and heading anchors. Same algorithm as Astro's heading IDs. */
export function slugify(value: string): string {
  return githubSlug(value);
}

/** Slugs for a list of headings in document order, with GitHub-style `-1` suffixes for repeats. */
export function slugifyAll(values: string[]): string[] {
  const slugger = new GithubSlugger();
  return values.map((value) => slugger.slug(value));
}

/** Text as a reader sees it: wiki syntax, highlights, comments and block IDs removed. */
export function plainText(value: string): string {
  return value
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(WIKILINK, (_all, _bang: string, inner: string) => {
      const pipe = inner.indexOf('|');
      return pipe === -1 ? inner.replace(/#\^?/g, ' › ') : inner.slice(pipe + 1);
    })
    .replace(/==/g, '')
    .replace(BLOCK_ID, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', '3gp']);

export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file';

export function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** `undefined` means "this is a note", any other value is an attachment. */
export function attachmentKind(path: string): AttachmentKind | undefined {
  const ext = extensionOf(path);
  if (!ext || ext === 'md') return undefined;
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}

/** Parses the part after `|` in an image embed: `400`, `400x300`, or a caption. */
export function parseImageAlias(alias: string | undefined): {
  width?: number;
  height?: number;
  caption?: string;
} {
  if (!alias) return {};
  const size = /^(\d+)(?:x(\d+))?$/.exec(alias);
  if (!size) return { caption: alias };
  return { width: Number(size[1]), height: size[2] ? Number(size[2]) : undefined };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
