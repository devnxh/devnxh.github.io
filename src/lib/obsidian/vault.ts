/**
 * The vault index: every note and attachment in `vault/`, parsed once, with
 * Obsidian's link resolution on top.
 *
 * It reads the file system directly instead of going through Astro's content
 * collections because the remark plugins need it while Astro is still
 * rendering Markdown. Pages use the same index for backlinks, tags, previews
 * and the build report.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { removeComments } from './remark/comments';
import {
  attachmentKind,
  BLOCK_ID,
  findTags,
  findWikilinks,
  linkKey,
  normaliseTag,
  parseImageAlias,
  plainText,
  slugify,
  slugifyAll,
  type AttachmentKind,
} from './syntax';
import { LITERAL, onlyChild, parseMarkdown, textOf, walk, type Node } from './tree';

export type Lang = 'en' | 'de';
export const LANGS: readonly Lang[] = ['en', 'de'];
export type Collection = 'writeups' | 'projects' | 'pages';
const COLLECTIONS: readonly Collection[] = ['writeups', 'projects', 'pages'];
const IGNORED_DIRS = new Set(['.obsidian', '.trash', '.git', 'templates', '_private', 'node_modules']);

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

export interface OutLink {
  kind: 'link' | 'embed';
  /** The link as written, for the build report. */
  raw: string;
  path: string;
  heading?: string;
  block?: string;
  /** Set for attachment targets. */
  attachment?: AttachmentKind;
  /** For image embeds: whether alt text or a caption was given. */
  described?: boolean;
}

export interface NoteFile {
  /** Path inside the vault with forward slashes, for example `writeups/Blue.md`. */
  file: string;
  abs: string;
  collection: Collection;
  lang: Lang;
  /** File name without `.md` and without the `.de` language suffix. */
  basename: string;
  slug: string;
  /** `collection/slug`, shared by all language variants of a note. */
  id: string;
  data: Record<string, unknown>;
  title: string;
  aliases: string[];
  /** `draft: true` in the frontmatter. */
  draft: boolean;
  /** A file or folder name in the path starts with `_`. */
  underscored: boolean;
  /** The parsed body with comments already removed. Clone before changing it. */
  tree: Node;
  headings: Heading[];
  blockIds: string[];
  tags: string[];
  links: OutLink[];
  excerpt: string;
  words: number;
}

export interface Note {
  id: string;
  collection: Collection;
  slug: string;
  variants: Partial<Record<Lang, NoteFile>>;
}

export interface Attachment {
  /** Path inside the vault with forward slashes. */
  file: string;
  abs: string;
  name: string;
  kind: AttachmentKind;
}

export interface Vault {
  root: string;
  includeHidden: boolean;
  notes: Map<string, Note>;
  files: NoteFile[];
  byFile: Map<string, NoteFile>;
  attachments: Attachment[];
  /** Two different files that produce the same URL. */
  collisions: Array<{ id: string; files: string[] }>;
}

export interface VaultOptions {
  /** Include drafts and `_`-prefixed files. True in dev, false in production. */
  includeHidden?: boolean;
}

export function splitFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) return { data: {}, body: source };
  let data: unknown = {};
  try {
    data = parseYaml(match[1] ?? '') ?? {};
  } catch {
    // Invalid YAML is reported by the content collection schema with a file name.
  }
  return {
    data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
    body: source.slice(match[0].length),
  };
}

function listFiles(dir: string, base = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) found.push(...listFiles(join(dir, entry.name), relative));
    } else if (entry.isFile()) {
      found.push(relative);
    }
  }
  return found;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => item != null).map(String);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function analyse(tree: Node): Pick<NoteFile, 'headings' | 'blockIds' | 'links' | 'excerpt' | 'words'> & {
  inlineTags: string[];
} {
  const headingTexts: Array<{ depth: number; text: string }> = [];
  const blockIds: string[] = [];
  const links: OutLink[] = [];
  const inlineTags: string[] = [];
  let excerpt = '';

  for (const block of tree.children ?? []) {
    if (excerpt || block.type !== 'paragraph') continue;
    const single = onlyChild(block);
    const isLoneEmbed = single?.type === 'text' && /^!\[\[[^\]]+\]\]$/.test((single.value ?? '').trim());
    const candidate = plainText(textOf(block));
    if (candidate && !isLoneEmbed && single?.type !== 'image') excerpt = candidate;
  }

  walk(tree, (node, parent) => {
    if (LITERAL.has(node.type)) return false;
    if (node.type === 'heading') {
      headingTexts.push({ depth: node.depth as number, text: plainText(textOf(node)) });
    }
    if (node.type === 'image' && !/^[a-z][a-z0-9+.-]*:/i.test(String(node.url))) {
      links.push({
        kind: 'embed',
        raw: `![${node.alt ?? ''}](${node.url})`,
        path: decodeURI(String(node.url)),
        attachment: 'image',
        described: Boolean(node.alt),
      });
    }
    if (node.type === 'link') {
      const url = String(node.url ?? '');
      const [pathPart = '', fragment] = url.split('#');
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /\.md$/i.test(pathPart)) {
        links.push({ kind: 'link', raw: url, path: decodeURI(pathPart), heading: fragment });
      }
      return false;
    }
    if (node.type !== 'text') return;

    const value = node.value ?? '';
    const blockId = BLOCK_ID.exec(value);
    if (blockId && parent?.children?.at(-1) === node) blockIds.push(blockId[1] as string);

    let withoutLinks = value;
    for (const link of findWikilinks(value)) {
      const kind = attachmentKind(link.path);
      const size = parseImageAlias(link.alias);
      links.push({
        kind: link.embed ? 'embed' : 'link',
        raw: link.raw,
        path: link.path,
        heading: link.heading,
        block: link.block,
        attachment: kind,
        described: kind === 'image' ? Boolean(size.caption) : undefined,
      });
      withoutLinks =
        withoutLinks.slice(0, link.start) + ' '.repeat(link.end - link.start) + withoutLinks.slice(link.end);
    }
    for (const tag of findTags(withoutLinks)) inlineTags.push(tag.tag);
    return;
  });

  const slugs = slugifyAll(headingTexts.map((heading) => heading.text));
  const headings = headingTexts.map((heading, index) => ({ ...heading, slug: slugs[index] as string }));
  const words = plainText(textOf(tree)).split(/\s+/).filter(Boolean).length;

  return { headings, blockIds, links, excerpt, words, inlineTags };
}

function readNote(root: string, file: string): NoteFile | undefined {
  const segments = file.split('/');
  const collection = COLLECTIONS.find((name) => name === segments[0]);
  if (!collection) return undefined;

  const fileName = segments.at(-1) as string;
  const stem = fileName.replace(/\.md$/i, '');
  const lang: Lang = /\.de$/i.test(stem) ? 'de' : 'en';
  const basename = lang === 'de' ? stem.replace(/\.de$/i, '') : stem;
  const slug = slugify(basename.replace(/^_+/, '')) || 'untitled';

  const abs = join(root, file);
  const { data, body } = splitFrontmatter(readFileSync(abs, 'utf8'));
  const tree = parseMarkdown(body);
  removeComments(tree);
  const { inlineTags, ...analysis } = analyse(tree);

  const tags = [...new Set([...stringList(data.tags).map(normaliseTag), ...inlineTags])].filter(Boolean);

  return {
    file,
    abs,
    collection,
    lang,
    basename,
    slug,
    id: `${collection}/${slug}`,
    data,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : basename.replace(/^_+/, ''),
    aliases: stringList(data.aliases),
    draft: data.draft === true,
    underscored: segments.some((segment) => segment.startsWith('_')),
    tree,
    tags,
    ...analysis,
  };
}

export function buildVault(root: string, options: VaultOptions = {}): Vault {
  const absoluteRoot = resolve(root);
  const vault: Vault = {
    root: absoluteRoot,
    includeHidden: options.includeHidden ?? false,
    notes: new Map(),
    files: [],
    byFile: new Map(),
    attachments: [],
    collisions: [],
  };
  if (!existsSync(absoluteRoot)) return vault;

  for (const file of listFiles(absoluteRoot).sort()) {
    if (/\.md$/i.test(file)) {
      const note = readNote(absoluteRoot, file);
      if (!note) continue;
      vault.files.push(note);
      vault.byFile.set(file.toLowerCase(), note);
      const logical = vault.notes.get(note.id) ?? {
        id: note.id,
        collection: note.collection,
        slug: note.slug,
        variants: {},
      };
      const existing = logical.variants[note.lang];
      if (existing) vault.collisions.push({ id: note.id, files: [existing.file, note.file] });
      else logical.variants[note.lang] = note;
      vault.notes.set(note.id, logical);
      continue;
    }
    const kind = attachmentKind(file);
    if (kind) {
      vault.attachments.push({ file, abs: join(absoluteRoot, file), name: file.split('/').at(-1) as string, kind });
    }
  }
  return vault;
}

/** A file is hidden when it is a draft or sits behind a `_` prefix. */
export function isHiddenFile(file: NoteFile): boolean {
  return file.draft || file.underscored;
}

/** The variant to show for a language: that language, else English, else whatever exists. */
export function variantFor(note: Note, lang: Lang): NoteFile {
  return (note.variants[lang] ?? note.variants.en ?? note.variants.de) as NoteFile;
}

/** Whether a note may be linked to and listed. Hidden notes exist only in dev. */
export function isVisible(vault: Vault, note: Note): boolean {
  const base = note.variants.en ?? note.variants.de;
  if (!base) return false;
  return vault.includeHidden || !isHiddenFile(base);
}

export function visibleNotes(vault: Vault, collection?: Collection): Note[] {
  return [...vault.notes.values()].filter(
    (note) => isVisible(vault, note) && (!collection || note.collection === collection),
  );
}

export function localePrefix(lang: Lang): string {
  return lang === 'en' ? '' : `/${lang}`;
}

export function noteUrl(note: Pick<Note, 'collection' | 'slug'>, lang: Lang): string {
  const section = note.collection === 'pages' ? '' : `/${note.collection}`;
  return `${localePrefix(lang)}${section}/${note.slug}/`;
}

export function attachmentUrl(attachment: Attachment): string {
  const path = attachment.file.replace(/^attachments\//, '');
  return `/attachments/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Obsidian's note lookup: case-insensitive, by full path, by path suffix, by
 * file name, then by frontmatter alias. Among equals the shortest path wins,
 * then a note in the linking note's own folder.
 */
export function resolveNote(vault: Vault, path: string, from?: NoteFile): Note | undefined {
  const key = linkKey(path);
  if (!key) return from ? vault.notes.get(from.id) : undefined;

  let best: { rank: number; depth: number; near: number; file: NoteFile } | undefined;
  const fromDir = from ? posix.dirname(from.file).toLowerCase() : '';

  for (const file of vault.files) {
    const pathKey = linkKey(file.file).replace(/\.de$/, '');
    const nameKey = linkKey(file.basename);
    let rank: number;
    if (pathKey === key) rank = 0;
    else if (pathKey.endsWith(`/${key}`)) rank = 1;
    else if (!key.includes('/') && nameKey === key) rank = 2;
    else if (file.aliases.some((alias) => linkKey(alias) === key)) rank = 3;
    else continue;

    const candidate = {
      rank,
      depth: file.file.split('/').length,
      near: posix.dirname(file.file).toLowerCase() === fromDir ? 0 : 1,
      file,
    };
    if (
      !best ||
      candidate.rank < best.rank ||
      (candidate.rank === best.rank && candidate.depth < best.depth) ||
      (candidate.rank === best.rank && candidate.depth === best.depth && candidate.near < best.near)
    ) {
      best = candidate;
    }
  }
  return best ? vault.notes.get(best.file.id) : undefined;
}

/** Resolves a Markdown link such as `../projects/PE-Sentinel.md` relative to the linking file. */
export function resolveRelative(vault: Vault, path: string, from: NoteFile): Note | undefined {
  const target = posix.normalize(posix.join(posix.dirname(from.file), path.replace(/\\/g, '/')));
  const file = vault.byFile.get(target.toLowerCase());
  return file ? vault.notes.get(file.id) : resolveNote(vault, posix.basename(path), from);
}

export function resolveAttachment(vault: Vault, path: string): Attachment | undefined {
  const key = path.trim().replace(/\\/g, '/').replace(/^(\.\.?\/)+/, '').toLowerCase();
  if (!key) return undefined;
  const matches = vault.attachments.filter((attachment) => {
    const file = attachment.file.toLowerCase();
    return file === key || file.endsWith(`/${key}`);
  });
  return matches.sort((a, b) => a.file.split('/').length - b.file.split('/').length)[0];
}

/** Finds a heading the way Obsidian does: by its visible text, ignoring case. */
export function findHeading(file: NoteFile, heading: string): Heading | undefined {
  const wanted = plainText(heading).toLowerCase();
  return (
    file.headings.find((candidate) => candidate.text.toLowerCase() === wanted) ??
    file.headings.find((candidate) => candidate.slug === slugify(heading))
  );
}

export function blockAnchor(id: string): string {
  return `b-${id.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// The site's own vault, cached. In dev the cache is checked against file
// modification times so edits in Obsidian show up without a restart.

let cached: { vault: Vault; signature: string; checkedAt: number } | undefined;

function signatureOf(root: string): string {
  if (!existsSync(root)) return '';
  return listFiles(root)
    .map((file) => {
      const stats = statSync(join(root, file));
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join('|');
}

export function vaultRoot(): string {
  return resolve(process.cwd(), 'vault');
}

/** True while `astro dev` runs. The Astro integration sets the variable. */
export function showHidden(): boolean {
  return process.env.OBSIDIAN_INCLUDE_HIDDEN === '1';
}

export function getVault(): Vault {
  const root = vaultRoot();
  const includeHidden = showHidden();
  const now = Date.now();
  if (cached && cached.vault.includeHidden === includeHidden) {
    if (!includeHidden || now - cached.checkedAt < 400) return cached.vault;
    const signature = signatureOf(root);
    cached.checkedAt = now;
    if (signature === cached.signature) return cached.vault;
  }
  cached = { vault: buildVault(root, { includeHidden }), signature: signatureOf(root), checkedAt: now };
  return cached.vault;
}

/** A fingerprint of the whole vault, mixed into content digests so that a change in one note re-renders the notes that link to it. */
export function vaultSignature(): string {
  return signatureOf(vaultRoot());
}
