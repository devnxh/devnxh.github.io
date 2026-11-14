import { posix } from 'node:path';
import type { Attachment, Lang, NoteFile, Vault } from '../vault';

/** State shared by the transforms while one Markdown file is rendered. */
export interface Context {
  vault: Vault;
  lang: Lang;
  /** The file that becomes the page. Image paths are written relative to it. */
  host?: NoteFile;
  /** The file whose Markdown is being transformed. Differs from `host` inside a note embed. */
  source?: NoteFile;
  /** 0 for the page itself, 1 and 2 inside embedded notes. */
  depth: number;
  /** Ids of the notes being embedded, outermost first. Stops loops. */
  stack: string[];
  /** Facts about the page that the layout needs (which optional assets to load). */
  flags: { hasMath: boolean; hasMermaid: boolean };
  counters: { footnote: number };
}

export function createContext(vault: Vault, host?: NoteFile): Context {
  return {
    vault,
    lang: host?.lang ?? 'en',
    host,
    source: host,
    depth: 0,
    stack: host ? [host.id] : [],
    flags: { hasMath: false, hasMermaid: false },
    counters: { footnote: 0 },
  };
}

/** Maximum nesting of `![[Note]]` inside `![[Note]]`. */
export const MAX_EMBED_DEPTH = 2;

/** The path Astro's image pipeline needs: relative to the Markdown file being rendered. */
export function relativeAssetPath(context: Context, attachment: Attachment): string {
  const fromDir = context.host ? posix.dirname(context.host.file) : '.';
  const relative = posix.relative(fromDir, attachment.file);
  return relative.startsWith('.') ? relative : `./${relative}`;
}
