/**
 * Read models for the pages. Each one joins a content collection entry
 * (validated frontmatter, rendering) with its record in the vault index
 * (language variants, tags, excerpt, links).
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { site, type Lang } from '../site.config';
import { backlinksOf, buildGraph } from './obsidian/graph';
import { resolveAttachment } from './obsidian/vault';
import { findWikilinks } from './obsidian/syntax';
import {
  getVault,
  isHiddenFile,
  noteUrl,
  variantFor,
  visibleNotes,
  type Attachment,
  type Collection,
  type Note,
  type NoteFile,
} from './obsidian/vault';

type Entry<C extends Collection> = CollectionEntry<C>;

interface Base<C extends Collection> {
  note: Note;
  /** The Markdown file shown for this language. */
  file: NoteFile;
  entry: Entry<C>;
  /** The language of the page. */
  lang: Lang;
  /** The language the content is written in. */
  contentLang: Lang;
  /** German page showing English text because no `.de.md` exists. */
  fallback: boolean;
  /** German file marked `translation: machine`. */
  machine: boolean;
  /** A draft or `_` file. Only ever true in dev. */
  hidden: boolean;
  slug: string;
  url: string;
  title: string;
  tags: string[];
  /** Link to the Markdown file on GitHub. */
  sourceUrl: string;
  /** Resolved `cover: "[[image.png]]"`, if the file exists. */
  cover?: Attachment;
}

export interface WriteupView extends Base<'writeups'> {
  description: string;
  date: Date;
  updated?: Date;
  category: Entry<'writeups'>['data']['category'];
  platform?: string;
  difficulty?: Entry<'writeups'>['data']['difficulty'];
  status?: Entry<'writeups'>['data']['status'];
  tools: string[];
  caseNo: number;
  /** `CASE-007` */
  caseId: string;
  minutes: number;
}

export interface ProjectView extends Base<'projects'> {
  summary: string;
  period?: string;
  year?: string;
  role?: string;
  status?: Entry<'projects'>['data']['status'];
  stack: string[];
  repo?: string;
  demo?: string;
  featured: boolean;
  highlights: string[];
  /** `A`, `B`, `C` … in display order, for "EXHIBIT A". */
  exhibit: string;
}

export interface PageView extends Base<'pages'> {
  description: string;
}

function fileKey(path: string | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/^.*?vault\//, '').toLowerCase();
}

async function entriesByFile<C extends Collection>(collection: C): Promise<Map<string, Entry<C>>> {
  const entries = await getCollection(collection);
  return new Map(entries.map((entry) => [fileKey(entry.filePath), entry]));
}

function shorten(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function coverOf(value: string | undefined): Attachment | undefined {
  if (!value) return undefined;
  const target = findWikilinks(value)[0]?.path ?? value;
  const attachment = resolveAttachment(getVault(), target);
  return attachment?.kind === 'image' ? attachment : undefined;
}

async function load<C extends Collection>(collection: C, lang: Lang): Promise<Array<Base<C>>> {
  const vault = getVault();
  const entries = await entriesByFile(collection);
  const views: Array<Base<C>> = [];
  for (const note of visibleNotes(vault, collection)) {
    const file = variantFor(note, lang);
    const entry = entries.get(file.file.toLowerCase());
    if (!entry) continue;
    const base = note.variants.en ?? file;
    views.push({
      note,
      file,
      entry,
      lang,
      contentLang: file.lang,
      fallback: file.lang !== lang,
      machine: file.lang === 'de' && entry.data.translation === 'machine',
      hidden: isHiddenFile(base),
      slug: note.slug,
      url: noteUrl(note, lang),
      title: entry.data.title ?? file.title,
      tags: [...new Set([...file.tags, ...(note.variants.en?.tags ?? [])])].sort(),
      sourceUrl: `${site.repo}/blob/${site.branch}/vault/${file.file.split('/').map(encodeURIComponent).join('/')}`,
      cover: coverOf(entry.data.cover ?? (note.variants.en?.data.cover as string | undefined)),
    });
  }
  return views;
}

export async function getWriteups(lang: Lang): Promise<WriteupView[]> {
  const bases = await load('writeups', lang);
  const english = await entriesByFile('writeups');

  // Case numbers follow the English originals in date order, so a translation
  // never changes them. Published cases are numbered before drafts.
  const dated = bases
    .map((base) => {
      const original = base.note.variants.en ? english.get(base.note.variants.en.file.toLowerCase()) : undefined;
      return { base, data: (original ?? base.entry).data };
    })
    .sort((a, b) => Number(a.base.hidden) - Number(b.base.hidden) || a.data.date.getTime() - b.data.date.getTime());

  const taken = new Set(dated.map((item) => item.data.case).filter((value): value is number => value !== undefined));
  let next = 1;
  const numbers = new Map<string, number>();
  for (const { base, data } of dated) {
    if (data.case !== undefined) {
      numbers.set(base.note.id, data.case);
      continue;
    }
    while (taken.has(next)) next += 1;
    numbers.set(base.note.id, next);
    next += 1;
  }

  return dated
    .map(({ base, data }) => {
      const own = base.entry.data;
      const caseNo = numbers.get(base.note.id) as number;
      return {
        ...base,
        description: own.description ?? shorten(base.file.excerpt),
        date: data.date,
        updated: own.updated ?? data.updated,
        category: data.category,
        platform: own.platform ?? data.platform,
        difficulty: data.difficulty,
        status: data.status,
        tools: own.tools.length > 0 ? own.tools : data.tools,
        caseNo,
        caseId: `CASE-${String(caseNo).padStart(3, '0')}`,
        minutes: Math.max(1, Math.round(base.file.words / 200)),
      } satisfies WriteupView;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.caseNo - a.caseNo);
}

export async function getProjects(lang: Lang): Promise<ProjectView[]> {
  const bases = await load('projects', lang);
  const english = await entriesByFile('projects');
  return bases
    .map((base) => {
      const original = base.note.variants.en ? english.get(base.note.variants.en.file.toLowerCase()) : undefined;
      const facts = (original ?? base.entry).data;
      const own = base.entry.data;
      const period = own.period ?? facts.period;
      return {
        base,
        order: facts.order,
        view: {
          ...base,
          summary: own.summary ?? facts.summary ?? shorten(base.file.excerpt),
          period,
          year: own.year ?? facts.year ?? period?.match(/\d{4}/g)?.at(-1),
          role: own.role ?? facts.role,
          status: facts.status,
          stack: own.stack.length > 0 ? own.stack : facts.stack,
          repo: facts.repo,
          demo: facts.demo,
          featured: facts.featured,
          highlights: own.highlights.length > 0 ? own.highlights : facts.highlights,
          exhibit: '',
        } satisfies ProjectView,
      };
    })
    .sort(
      (a, b) =>
        Number(b.view.featured) - Number(a.view.featured) || a.order - b.order || a.view.title.localeCompare(b.view.title),
    )
    .map(({ view }, index) => ({ ...view, exhibit: String.fromCharCode(65 + index) }));
}

export async function getPage(slug: string, lang: Lang): Promise<PageView | undefined> {
  const base = (await load('pages', lang)).find((page) => page.slug === slug);
  return base ? { ...base, description: base.entry.data.description ?? shorten(base.file.excerpt) } : undefined;
}

// --- Tags ---------------------------------------------------------------------

export interface TagGroup {
  tag: string;
  writeups: WriteupView[];
  projects: ProjectView[];
  count: number;
}

/** Every tag with its notes. A nested tag such as `windows/smb` also counts for `windows`. */
export async function getTags(lang: Lang): Promise<TagGroup[]> {
  const [writeups, projects] = await Promise.all([getWriteups(lang), getProjects(lang)]);
  const groups = new Map<string, TagGroup>();
  const group = (tag: string): TagGroup => {
    if (!groups.has(tag)) groups.set(tag, { tag, writeups: [], projects: [], count: 0 });
    return groups.get(tag) as TagGroup;
  };
  const withParents = (tags: string[]): string[] => [
    ...new Set(tags.flatMap((tag) => tag.split('/').map((_part, index, parts) => parts.slice(0, index + 1).join('/')))),
  ];
  for (const writeup of writeups) for (const tag of withParents(writeup.tags)) group(tag).writeups.push(writeup);
  for (const project of projects) for (const tag of withParents(project.tags)) group(tag).projects.push(project);
  return [...groups.values()]
    .map((entry) => ({ ...entry, count: entry.writeups.length + entry.projects.length }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

// --- Links between notes ---------------------------------------------------------

export interface NoteRef {
  id: string;
  collection: Collection;
  title: string;
  url: string;
  /** `CASE-007` for write-ups. */
  caseId?: string;
}

function toRef(note: Note, lang: Lang, writeups: WriteupView[]): NoteRef {
  return {
    id: note.id,
    collection: note.collection,
    title: variantFor(note, lang).title,
    url: noteUrl(note, lang),
    caseId: writeups.find((writeup) => writeup.note.id === note.id)?.caseId,
  };
}

/** Notes that link to or embed the given note. */
export async function getBacklinks(id: string, lang: Lang): Promise<NoteRef[]> {
  const vault = getVault();
  const writeups = await getWriteups(lang);
  return backlinksOf(vault, buildGraph(vault), id).map((note) => toRef(note, lang, writeups));
}

/** Write-ups that link to a project or are linked from it. */
export async function getRelatedWriteups(id: string, lang: Lang): Promise<WriteupView[]> {
  const graph = buildGraph(getVault());
  const linked = new Set([...(graph.incoming.get(id) ?? []), ...(graph.outgoing.get(id) ?? [])]);
  return (await getWriteups(lang)).filter((writeup) => linked.has(writeup.note.id));
}

/** Other write-ups that share the most tags, newest first among equals. */
export function relatedByTag(current: WriteupView, all: WriteupView[], limit = 3): WriteupView[] {
  return all
    .filter((other) => other.note.id !== current.note.id)
    .map((other) => ({ other, shared: other.tags.filter((tag) => current.tags.includes(tag)).length }))
    .filter((item) => item.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.other.date.getTime() - a.other.date.getTime())
    .slice(0, limit)
    .map((item) => item.other);
}

/** Title and first paragraph of every note, keyed by URL, for hover previews. */
export async function getLinkIndex(lang: Lang): Promise<Record<string, { title: string; excerpt: string; label: string }>> {
  const [writeups, projects] = await Promise.all([getWriteups(lang), getProjects(lang)]);
  const about = await getPage('about', lang);
  const index: Record<string, { title: string; excerpt: string; label: string }> = {};
  for (const writeup of writeups) {
    index[writeup.url] = { title: writeup.title, excerpt: writeup.description, label: writeup.caseId };
  }
  for (const project of projects) {
    index[project.url] = { title: project.title, excerpt: project.summary, label: `EXHIBIT ${project.exhibit}` };
  }
  if (about) index[about.url] = { title: about.title, excerpt: about.description, label: '' };
  return index;
}
