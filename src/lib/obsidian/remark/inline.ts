/**
 * The small inline transforms: inline footnotes, block IDs, highlights, tags,
 * and the per-code-block housekeeping.
 */
import { BLOCK_ID, escapeHtml, findTags } from '../syntax';
import { element, html, LITERAL, rewriteText, text, walk, type Node } from '../tree';
import { blockAnchor, localePrefix } from '../vault';
import type { Context } from './context';

// --- Inline footnotes: text^[a note written in place] ----------------------

/** Index just past the `]` that closes a footnote opened before `from`, or -1. Nested brackets are balanced. */
function closingBracket(value: string, from: number, depth: { open: number }): number {
  for (let index = from; index < value.length; index += 1) {
    const char = value[index];
    if (char === '[') depth.open += 1;
    else if (char === ']') {
      if (depth.open === 0) return index;
      depth.open -= 1;
    }
  }
  return -1;
}

function convertFirstFootnote(parent: Node, root: Node, context: Context): boolean {
  const children = parent.children ?? [];
  for (let start = 0; start < children.length; start += 1) {
    const opener = children[start] as Node;
    if (opener.type !== 'text') continue;
    const at = (opener.value ?? '').indexOf('^[');
    if (at === -1) continue;

    const before = (opener.value ?? '').slice(0, at);
    const depth = { open: 0 };
    const content: Node[] = [];
    let remainder = (opener.value ?? '').slice(at + 2);

    for (let end = start; end < children.length; end += 1) {
      const node = children[end] as Node;
      if (end > start && node.type !== 'text') {
        content.push(node);
        continue;
      }
      const value = end === start ? remainder : (node.value ?? '');
      const close = closingBracket(value, 0, depth);
      if (close === -1) {
        if (value) content.push(text(value));
        continue;
      }
      if (close > 0) content.push(text(value.slice(0, close)));
      remainder = value.slice(close + 1);

      context.counters.footnote += 1;
      const identifier = `inline-${context.counters.footnote}`;
      // Added to the tree now, so the transforms that run later (wikilinks, tags) also see the note.
      root.children?.push({
        type: 'footnoteDefinition',
        identifier,
        label: identifier,
        children: [{ type: 'paragraph', children: content }],
      });
      parent.children = [
        ...children.slice(0, start),
        ...(before ? [text(before)] : []),
        { type: 'footnoteReference', identifier, label: identifier },
        ...(remainder ? [text(remainder)] : []),
        ...children.slice(end + 1),
      ];
      return true;
    }
    return false; // opened but never closed: leave the text as written
  }
  return false;
}

export function transformInlineFootnotes(tree: Node, context: Context): void {
  walk(tree, (node) => {
    if (LITERAL.has(node.type)) return false;
    if (!node.children?.some((child) => child.type === 'text' && (child.value ?? '').includes('^['))) return;
    while (convertFirstFootnote(node, tree, context)) {
      /* keep going until this parent has no inline footnote left */
    }
    return;
  });
}

// --- Block IDs: a paragraph that ends with ^some-id -------------------------

function setId(node: Node, id: string): void {
  node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: blockAnchor(id) } };
}

export function transformBlockIds(tree: Node, context: Context): void {
  const visit = (parent: Node): void => {
    const children = parent.children ?? [];
    const kept: Node[] = [];
    for (const child of children) {
      if (LITERAL.has(child.type)) {
        kept.push(child);
        continue;
      }
      if (child.type === 'paragraph' || child.type === 'heading') {
        const last = child.children?.at(-1);
        const match = last?.type === 'text' ? BLOCK_ID.exec(last.value ?? '') : null;
        if (last && match) {
          last.value = (last.value ?? '').slice(0, match.index);
          if (!last.value) child.children?.pop();
          const id = match[1] as string;
          const isEmpty = !(child.children ?? []).some((node) => node.type !== 'text' || (node.value ?? '').trim());
          if (isEmpty) {
            // A lone `^id` line labels the block before it (a table, a quote, a callout).
            const previous = kept.at(-1);
            if (previous && context.depth === 0) setId(previous, id);
            continue;
          }
          // Inside an embed the marker is removed but no id is set, so ids stay unique on the page.
          if (context.depth === 0) setId(child, id);
        }
      }
      visit(child);
      kept.push(child);
    }
    parent.children = kept;
  };
  visit(tree);
}

// --- Highlights: ==marked text== -------------------------------------------

const MARKER = Symbol('highlight marker');

function highlightChildren(parent: Node): void {
  const children = parent.children ?? [];
  if (!children.some((child) => child.type === 'text' && (child.value ?? '').includes('=='))) return;

  const tokens: Array<Node | typeof MARKER> = [];
  for (const child of children) {
    if (child.type !== 'text') {
      tokens.push(child);
      continue;
    }
    (child.value ?? '').split('==').forEach((part, index) => {
      if (index > 0) tokens.push(MARKER);
      if (part) tokens.push(text(part));
    });
  }

  const startsWithSpace = (token: Node | typeof MARKER | undefined): boolean =>
    token === undefined || token === MARKER || (token.type === 'text' && /^\s/.test(token.value ?? ''));
  const endsWithSpace = (token: Node | typeof MARKER | undefined): boolean =>
    token === undefined || token === MARKER || (token.type === 'text' && /\s$/.test(token.value ?? ''));

  const output: Node[] = [];
  let buffer: Node[] | undefined;
  tokens.forEach((token, index) => {
    if (token !== MARKER) {
      (buffer ?? output).push(token);
      return;
    }
    if (!buffer) {
      // An opening marker must touch the text it marks: `a == b` is not a highlight.
      if (startsWithSpace(tokens[index + 1])) output.push(text('=='));
      else buffer = [];
      return;
    }
    if (endsWithSpace(tokens[index - 1])) {
      buffer.push(text('=='));
      return;
    }
    output.push(element('mark', {}, buffer, 'mark'));
    buffer = undefined;
  });
  if (buffer) output.push(text('=='), ...buffer);

  // Merge neighbouring text nodes so later transforms see whole words.
  parent.children = output.reduce<Node[]>((merged, node) => {
    const previous = merged.at(-1);
    if (node.type === 'text' && previous?.type === 'text') previous.value = (previous.value ?? '') + (node.value ?? '');
    else merged.push(node);
    return merged;
  }, []);
}

export function transformHighlights(tree: Node): void {
  walk(tree, (node) => {
    if (LITERAL.has(node.type)) return false;
    if (node.children) highlightChildren(node);
    return;
  });
}

// --- Tags: #tag and #nested/tag ---------------------------------------------

const NO_TAGS_INSIDE = new Set(['link', 'linkReference', 'footnoteReference']);

export function tagUrl(tag: string, context: Pick<Context, 'lang'>): string {
  return `${localePrefix(context.lang)}/tags/${tag.split('/').map(encodeURIComponent).join('/')}/`;
}

export function transformTags(tree: Node, context: Context): void {
  rewriteText(tree, NO_TAGS_INSIDE, (value) => {
    const tags = findTags(value);
    if (tags.length === 0) return undefined;
    const nodes: Node[] = [];
    let cursor = 0;
    for (const tag of tags) {
      if (tag.start > cursor) nodes.push(text(value.slice(cursor, tag.start)));
      nodes.push({
        type: 'link',
        url: tagUrl(tag.tag, context),
        data: { hProperties: { class: 'tag' } },
        children: [text(`#${tag.text}`)],
      });
      cursor = tag.end;
    }
    if (cursor < value.length) nodes.push(text(value.slice(cursor)));
    return nodes;
  });
}

// --- Code blocks -------------------------------------------------------------

/** Languages Shiki knows under another name. */
const LANGUAGE_ALIASES: Record<string, string> = { nasm: 'asm', assembly: 'asm', x86asm: 'asm', ps1: 'powershell' };

export const LINE_NUMBER_THRESHOLD = 10;

export function transformCode(tree: Node, context: Context): void {
  walk(tree, (node) => {
    if (node.type === 'math' || node.type === 'inlineMath') context.flags.hasMath = true;
    if (node.type !== 'code') return;

    const lang = String(node.lang ?? '').toLowerCase();
    if (lang === 'mermaid') {
      // Left as text for the browser: Mermaid is loaded only on pages that have a diagram.
      context.flags.hasMermaid = true;
      const source = escapeHtml(node.value ?? '');
      Object.assign(node, html(`<figure class="mermaid-figure"><pre class="mermaid-source" data-mermaid>${source}</pre></figure>`));
      delete node.lang;
      delete node.meta;
      return;
    }
    if (LANGUAGE_ALIASES[lang]) node.lang = LANGUAGE_ALIASES[lang];

    const lines = (node.value ?? '').split('\n').length;
    const meta = String(node.meta ?? '');
    if (lines > LINE_NUMBER_THRESHOLD && !/showLineNumbers/.test(meta)) {
      node.meta = `${meta} showLineNumbers`.trim();
    }
  });
}
