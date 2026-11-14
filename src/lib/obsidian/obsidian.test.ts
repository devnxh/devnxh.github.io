import { fileURLToPath } from 'node:url';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { backlinksOf, buildGraph, buildReport } from './graph';
import { renderObsidian } from './remark';
import { findTags, findWikilinks } from './syntax';
import { parseMarkdown } from './tree';
import { buildVault, resolveNote, type Vault } from './vault';

const root = fileURLToPath(new URL('./__fixtures__/vault', import.meta.url));
const vault = buildVault(root);
const devVault = buildVault(root, { includeHidden: true });

const toHtml = unified().use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeStringify);

function render(markdown: string, from = 'writeups/beta.md', source: Vault = vault): string {
  const tree = parseMarkdown(markdown);
  renderObsidian(tree, source, source.byFile.get(from));
  return String(toHtml.stringify(toHtml.runSync(tree as never) as never));
}

describe('syntax', () => {
  it('parses wikilinks with headings, blocks and aliases', () => {
    const [plain, heading, block, embed] = findWikilinks('[[Note]] [[Note#Head|alias]] [[Note#^id]] ![[img.png|400]]');
    expect(plain).toMatchObject({ path: 'Note', embed: false });
    expect(heading).toMatchObject({ path: 'Note', heading: 'Head', alias: 'alias' });
    expect(block).toMatchObject({ block: 'id' });
    expect(embed).toMatchObject({ embed: true, path: 'img.png', alias: '400' });
  });

  it('finds tags by Obsidian rules', () => {
    expect(findTags('#windows and #smb/enum but not #123 or a#b').map((tag) => tag.tag)).toEqual(['windows', 'smb/enum']);
  });
});

describe('vault', () => {
  it('ignores templates and indexes notes with language variants', () => {
    expect(vault.files.some((file) => file.file.startsWith('templates/'))).toBe(false);
    expect(Object.keys(vault.notes.get('writeups/beta')?.variants ?? {})).toEqual(['de', 'en']);
  });

  it('resolves links case-insensitively and by alias', () => {
    expect(resolveNote(vault, 'alpha note')?.id).toBe('writeups/alpha-note');
    expect(resolveNote(vault, 'First Alpha')?.id).toBe('writeups/alpha-note');
    expect(resolveNote(vault, 'Missing Note')).toBeUndefined();
  });

  it('collects frontmatter and inline tags, and strips comments from the excerpt', () => {
    const alpha = vault.byFile.get('writeups/alpha note.md');
    expect(alpha?.tags).toEqual(['windows', 'recon', 'smb/enum']);
    expect(alpha?.excerpt).not.toContain('secret');
  });

  it('builds backlinks and the warnings report', () => {
    const graph = buildGraph(vault);
    expect(backlinksOf(vault, graph, 'writeups/alpha-note').map((note) => note.id)).toEqual(['writeups/beta', 'projects/tool']);
    const report = buildReport(vault);
    expect(report.unresolvedLinks.map((entry) => entry.target)).toEqual(
      expect.arrayContaining(['[[Missing Note]]', '[[_hidden]]', '[[Draft]]']),
    );
    expect(report.missingAttachments.map((entry) => entry.target)).toContain('![[nope.png]]');
    expect(report.undescribedImages.map((entry) => entry.target)).toContain('![[shot.png|300]]');
  });
});

describe('remarkObsidian', () => {
  it('removes comments completely', () => {
    const html = render('Seen %%hidden%% text.\n\n%%\n\nblock\n\n%%\n\nAfter.');
    expect(html).not.toMatch(/hidden|block|%%/);
    expect(html).toContain('After.');
  });

  it('links resolved notes and mutes unresolved ones', () => {
    const html = render('[[alpha note#Recon Phase|the recon]] and [[Missing Note]] and [[Draft]]');
    expect(html).toContain('href="/writeups/alpha-note/#recon-phase"');
    expect(html).toContain('<span class="unresolved"');
    expect(html).not.toContain('/writeups/draft/');
  });

  it('shows hidden notes in dev only', () => {
    expect(render('[[Draft]]', 'writeups/beta.md', devVault)).toContain('/writeups/draft/');
  });

  it('points German pages at German URLs', () => {
    expect(render('[[Alpha Note]]', 'writeups/beta.de.md')).toContain('href="/de/writeups/alpha-note/"');
  });

  it('embeds images as figures and transcludes blocks', () => {
    const html = render('![[shot.png|300]]\n\n![[Pasted image 20261120123456.png|A caption]]\n\n![[Alpha Note#^fact]]');
    expect(html).toContain('width="300"');
    expect(html).toContain('<figcaption>A caption</figcaption>');
    expect(html).toContain('class="embed"');
    expect(html).toContain('A fact worth quoting.');
    expect(html).not.toContain('^fact');
  });

  it('stops embed loops', () => {
    const html = render('![[Loop B]]', 'writeups/loop a.md');
    expect(html.match(/class="embed"/g)?.length).toBe(1);
  });

  it('renders callouts, the flag callout, highlights, tags, block ids and inline footnotes', () => {
    const html = render(
      '> [!warning]- Careful **now**\n> Body\n\n> [!flag]\n> THM{x}\n\n==marked== #smb/enum\n\nBlock. ^b1\n\nNote^[an *inline* note].',
    );
    expect(html).toContain('<details class="callout" data-callout="warning"');
    expect(html).toContain('<details class="redaction">');
    expect(html).toContain('<mark>marked</mark>');
    expect(html).toContain('href="/tags/smb/enum/"');
    expect(html).toContain('id="b-b1"');
    expect(html).toContain('data-footnote-ref');
    expect(html).toContain('an <em>inline</em> note');
  });
});
