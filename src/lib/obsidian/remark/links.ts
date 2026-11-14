/**
 * Wikilinks, file embeds, note transclusion and Markdown links to `.md` files.
 */
import { BLOCK_ID, attachmentKind, escapeHtml, findWikilinks, parseImageAlias, plainText, slugify, type WikiLink } from '../syntax';
import { clone, element, html, onlyChild, rewriteText, text, textOf, walk, type Node } from '../tree';
import {
  attachmentUrl,
  blockAnchor,
  findHeading,
  isVisible,
  noteUrl,
  resolveAttachment,
  resolveNote,
  resolveRelative,
  variantFor,
  type Attachment,
  type Note,
  type NoteFile,
} from '../vault';
import { MAX_EMBED_DEPTH, relativeAssetPath, type Context } from './context';

const LABELS = {
  en: { unresolved: 'This note does not exist yet', missing: 'Missing attachment', download: 'Download', embedded: 'Embedded from' },
  de: { unresolved: 'Diese Notiz existiert noch nicht', missing: 'Fehlender Anhang', download: 'Herunterladen', embedded: 'Eingebettet aus' },
} as const;

function displayText(link: WikiLink): string {
  if (link.alias) return link.alias;
  if (!link.path) return link.heading ?? link.block ?? '';
  return link.heading ? `${link.path} › ${link.heading}` : link.path;
}

/** Muted text with a dashed underline: never a link to a 404. */
function unresolved(label: string, title: string): Node {
  return element('span', { class: 'unresolved', title }, [text(label)]);
}

function visibleNote(link: WikiLink, context: Context): Note | undefined {
  const note = resolveNote(context.vault, link.path, context.source);
  return note && isVisible(context.vault, note) ? note : undefined;
}

function hrefFor(note: Note, link: Pick<WikiLink, 'heading' | 'block'>, context: Context): string {
  const target = variantFor(note, context.lang);
  const samePage = context.depth === 0 && context.host?.id === note.id;
  let href = samePage ? '' : noteUrl(note, context.lang);
  if (link.heading) href += `#${findHeading(target, link.heading)?.slug ?? slugify(link.heading)}`;
  else if (link.block) href += `#${blockAnchor(link.block)}`;
  return href || noteUrl(note, context.lang);
}

function noteLink(note: Note, link: WikiLink, context: Context, label = displayText(link)): Node {
  return {
    type: 'link',
    url: hrefFor(note, link, context),
    // `data-wl` lets the German fallback pages and the hover previews find internal links.
    data: { hProperties: { class: 'wikilink', dataWl: note.id } },
    children: [text(label || variantFor(note, context.lang).title)],
  };
}

function imageNode(attachment: Attachment, link: WikiLink, context: Context): { image: Node; caption?: string } {
  const { width, height, caption } = parseImageAlias(link.alias);
  const properties: Record<string, unknown> = {};
  if (width) properties.width = width;
  if (height) properties.height = height;
  return {
    image: {
      type: 'image',
      url: relativeAssetPath(context, attachment),
      alt: caption ?? '',
      data: { hProperties: properties },
    },
    caption,
  };
}

function mediaHtml(attachment: Attachment, context: Context): string {
  const url = escapeHtml(attachmentUrl(attachment));
  const name = escapeHtml(attachment.name);
  const labels = LABELS[context.lang];
  const download = `<a href="${url}" download>${labels.download} ${name}</a>`;
  if (attachment.kind === 'video') {
    return `<video controls preload="metadata" src="${url}">${download}</video>`;
  }
  if (attachment.kind === 'audio') {
    return `<audio controls preload="metadata" src="${url}">${download}</audio>`;
  }
  return `<object class="pdf" data="${url}" type="application/pdf" aria-label="${name}"><p>${download}</p></object>`;
}

// --- Note transclusion -------------------------------------------------------

/** The blocks of `target` that an embed asks for: the whole note, one section, or one block. */
export function selectContent(target: NoteFile, link: Pick<WikiLink, 'heading' | 'block'>): Node[] | undefined {
  const blocks = clone(target.tree).children ?? [];

  if (link.heading) {
    const wanted = findHeading(target, link.heading);
    if (!wanted) return undefined;
    const start = blocks.findIndex(
      (node) => node.type === 'heading' && plainText(textOf(node)).toLowerCase() === wanted.text.toLowerCase(),
    );
    if (start === -1) return undefined;
    const depth = (blocks[start] as Node).depth as number;
    let end = start + 1;
    while (end < blocks.length && !(blocks[end]?.type === 'heading' && (blocks[end]?.depth as number) <= depth)) {
      end += 1;
    }
    return blocks.slice(start, end);
  }

  if (link.block) {
    const marker = new RegExp(`(?:^|\\s)\\^${link.block}\\s*$`, 'i');
    const find = (siblings: Node[]): Node[] | undefined => {
      for (let index = 0; index < siblings.length; index += 1) {
        const node = siblings[index] as Node;
        if (node.type === 'paragraph' || node.type === 'heading') {
          if (!marker.test(textOf(node))) continue;
          // A lone `^id` line labels the block before it.
          const lone = BLOCK_ID.test(textOf(node).trim()) && textOf(node).trim().startsWith('^');
          return lone && index > 0 ? [siblings[index - 1] as Node] : [node];
        }
        if (node.type === 'listItem') {
          const own = node.children?.[0];
          if (own?.type === 'paragraph' && marker.test(textOf(own))) {
            return [{ type: 'list', ordered: false, spread: false, children: [node] }];
          }
        }
        const nested = node.children ? find(node.children) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };
    return find(blocks);
  }

  return blocks;
}

function noteEmbed(
  note: Note,
  link: WikiLink,
  context: Context,
  transform: (tree: Node, context: Context) => void,
): Node | undefined {
  if (context.depth >= MAX_EMBED_DEPTH || context.stack.includes(note.id)) return undefined;
  const target = variantFor(note, context.lang);
  const content = selectContent(target, link);
  if (!content) return undefined;

  const root: Node = { type: 'root', children: content };
  transform(root, { ...context, source: target, depth: context.depth + 1, stack: [...context.stack, note.id] });

  // Headings inside an embed must not join the page outline or reuse its anchors.
  walk(root, (node) => {
    if (node.type !== 'heading') return;
    node.type = 'paragraph';
    node.data = { hName: 'p', hProperties: { class: 'embed-heading' } };
    delete node.depth;
  });

  const sourceLabel = link.heading ? `${target.title} › ${link.heading}` : target.title;
  const source = element('p', { class: 'embed-source' }, [
    element('span', { class: 'embed-label' }, [text(LABELS[context.lang].embedded)]),
    text(' '),
    noteLink(note, link, context, sourceLabel),
  ]);
  return element('div', { class: 'embed', dataEmbed: note.id }, [source, ...(root.children ?? [])]);
}

// --- Block-level embeds: a paragraph holding only ![[...]] -------------------

function blockEmbed(
  link: WikiLink,
  context: Context,
  transform: (tree: Node, context: Context) => void,
): Node | undefined {
  const kind = attachmentKind(link.path);
  const labels = LABELS[context.lang];

  if (!kind) {
    const note = visibleNote(link, context);
    return note ? noteEmbed(note, link, context, transform) : undefined;
  }

  const attachment = resolveAttachment(context.vault, link.path);
  if (!attachment) {
    return { type: 'paragraph', children: [unresolved(`${labels.missing}: ${link.path}`, labels.missing)] };
  }

  if (kind === 'image') {
    const { image, caption } = imageNode(attachment, link, context);
    const children = caption ? [image, element('figcaption', {}, [text(caption)])] : [image];
    return element('figure', { class: 'figure', dataZoom: '' }, children, 'figure');
  }
  if (kind === 'file') return undefined;

  const caption = link.alias ? [element('figcaption', {}, [text(link.alias)])] : [];
  const download =
    kind === 'pdf'
      ? [
          element('p', { class: 'media-download' }, [
            { type: 'link', url: attachmentUrl(attachment), data: { hProperties: { download: true } }, children: [text(`${labels.download} ${attachment.name}`)] },
          ]),
        ]
      : [];
  return element('figure', { class: `media media-${kind}` }, [html(mediaHtml(attachment, context)), ...download, ...caption], 'figure');
}

// --- Inline wikilinks and embeds ---------------------------------------------

function inlineNode(link: WikiLink, context: Context): Node {
  const kind = attachmentKind(link.path);
  const labels = LABELS[context.lang];

  if (!kind) {
    const note = visibleNote(link, context);
    return note ? noteLink(note, link, context) : unresolved(displayText(link), labels.unresolved);
  }

  const attachment = resolveAttachment(context.vault, link.path);
  if (!attachment) return unresolved(link.alias ?? link.path, labels.missing);

  if (link.embed) {
    if (kind === 'image') return imageNode(attachment, link, context).image;
    if (kind === 'video' || kind === 'audio') return html(mediaHtml(attachment, context));
  }
  return { type: 'link', url: attachmentUrl(attachment), children: [text(link.alias ?? attachment.name)] };
}

const NO_LINKS_INSIDE = new Set(['link', 'linkReference']);

export function transformLinks(
  tree: Node,
  context: Context,
  transform: (tree: Node, context: Context) => void,
): void {
  // 1. Paragraphs that are a single embed become block elements.
  walk(tree, (parent) => {
    if (!parent.children) return;
    parent.children = parent.children.map((child) => {
      if (child.type !== 'paragraph') return child;
      const only = onlyChild(child);
      if (only?.type !== 'text') return child;
      const links = findWikilinks((only.value ?? '').trim());
      const link = links[0];
      if (links.length !== 1 || !link?.embed || link.raw !== (only.value ?? '').trim()) return child;
      return blockEmbed(link, context, transform) ?? child;
    });
  });

  // 2. Everything else is handled inline.
  rewriteText(tree, NO_LINKS_INSIDE, (value) => {
    const links = findWikilinks(value);
    if (links.length === 0) return undefined;
    const nodes: Node[] = [];
    let cursor = 0;
    for (const link of links) {
      if (link.start > cursor) nodes.push(text(value.slice(cursor, link.start)));
      nodes.push(inlineNode(link, context));
      cursor = link.end;
    }
    if (cursor < value.length) nodes.push(text(value.slice(cursor)));
    return nodes;
  });

  // 3. Ordinary Markdown links to .md files point at the built page.
  walk(tree, (node) => {
    if (node.type !== 'link' || !context.source) return;
    const url = String(node.url ?? '');
    const [path = '', fragment] = url.split('#');
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || !/\.md$/i.test(path)) return;
    const note = resolveRelative(context.vault, decodeURI(path), context.source);
    if (!note || !isVisible(context.vault, note)) {
      Object.assign(node, unresolved(textOf(node), LABELS[context.lang].unresolved));
      delete node.url;
      return;
    }
    node.url = hrefFor(note, { heading: fragment ? decodeURIComponent(fragment) : undefined }, context);
    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, class: 'wikilink', dataWl: note.id } };
  });
}
