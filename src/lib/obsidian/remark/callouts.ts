import { element, html, text, walk, type Node } from '../tree';
import type { Context } from './context';

/** Obsidian's aliases, mapped to the callout they are a synonym of. */
const ALIASES: Record<string, string> = {
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  important: 'tip',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  caution: 'warning',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
  spoiler: 'flag',
};

export const CALLOUT_KINDS = [
  'note',
  'abstract',
  'info',
  'todo',
  'tip',
  'success',
  'question',
  'warning',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
  'flag',
] as const;

/** Maps a kind to one of the seven colour meanings in the design tokens. */
const HUES: Record<string, string> = {
  note: 'note',
  info: 'note',
  todo: 'note',
  tip: 'tip',
  success: 'tip',
  warning: 'warning',
  danger: 'danger',
  failure: 'danger',
  bug: 'danger',
  question: 'question',
  abstract: 'question',
  example: 'example',
  quote: 'quote',
};

// Simple 24px line icons drawn for this site, in the style Obsidian uses.
const ICON_PATHS: Record<string, string> = {
  note: '<path d="M4 20l1-5L16 4l4 4L9 19l-5 1z"/><path d="M13 7l4 4"/>',
  abstract: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  todo: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  tip: '<path d="M12 3c3 3 6 6 6 10a6 6 0 0 1-12 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 2-9z"/>',
  success: '<path d="M4 12l5 5L20 6"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5"/>',
  warning: '<path d="M12 3l10 17H2L12 3z"/><path d="M12 10v5M12 17.5v.5"/>',
  failure: '<path d="M6 6l12 12M18 6L6 18"/>',
  danger: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  bug: '<rect x="8" y="8" width="8" height="12" rx="4"/><path d="M9 8a3 3 0 0 1 6 0M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 20l3-2M19 20l-3-2M12 12v8"/>',
  example: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5"/>',
  quote: '<path d="M10 7H5v6h4v1a3 3 0 0 1-3 3M20 7h-5v6h4v1a3 3 0 0 1-3 3"/>',
};

function icon(kind: string): Node {
  const paths = ICON_PATHS[kind] ?? ICON_PATHS.note;
  return html(
    `<svg class="callout-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  );
}

const MARKER = /^\[!([^\]\n]+)\]([+-]?)[ \t]*/;

const REDACTION_LABEL: Record<string, string> = {
  en: 'REDACTED, select to reveal',
  de: 'GESCHWÄRZT, zum Anzeigen auswählen',
};

/** Splits the first paragraph of a callout into its title line and the body that follows. */
function splitTitle(paragraph: Node): { title: Node[]; rest: Node[] } {
  const title: Node[] = [];
  const children = paragraph.children ?? [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index] as Node;
    if (child.type === 'break') return { title, rest: children.slice(index + 1) };
    if (child.type === 'text') {
      const value = child.value ?? '';
      const newline = value.indexOf('\n');
      if (newline !== -1) {
        if (newline > 0) title.push(text(value.slice(0, newline)));
        const after = value.slice(newline + 1);
        return { title, rest: [...(after ? [text(after)] : []), ...children.slice(index + 1)] };
      }
    }
    title.push(child);
  }
  return { title, rest: [] };
}

function toCallout(quote: Node, context: Context): void {
  const first = quote.children?.[0];
  const lead = first?.type === 'paragraph' ? first.children?.[0] : undefined;
  if (!first || lead?.type !== 'text') return;
  const marker = MARKER.exec(lead.value ?? '');
  if (!marker) return;

  const typed = (marker[1] ?? '').trim();
  const lower = typed.toLowerCase();
  const kind = ALIASES[lower] ?? lower;
  const fold = marker[2];
  lead.value = (lead.value ?? '').slice(marker[0].length);

  const { title, rest } = splitTitle(first);
  const body: Node[] = [
    ...(rest.length > 0 ? [{ type: 'paragraph', children: rest }] : []),
    ...(quote.children ?? []).slice(1),
  ];
  const hasTitle = title.some((node) => node.type !== 'text' || (node.value ?? '').trim());

  if (kind === 'flag') {
    const label = hasTitle ? title : [text(REDACTION_LABEL[context.lang] ?? (REDACTION_LABEL.en as string))];
    quote.type = 'callout';
    quote.data = { hName: 'details', hProperties: { class: 'redaction' } };
    quote.children = [
      element('summary', { class: 'redaction-bar' }, [element('span', { class: 'redaction-label' }, label)]),
      element('div', { class: 'redaction-body' }, body),
    ];
    return;
  }

  const titleNodes = hasTitle ? title : [text(typed.charAt(0).toUpperCase() + typed.slice(1).toLowerCase())];
  const titleChildren = [icon(kind), element('span', { class: 'callout-title-text' }, titleNodes)];
  const properties = { class: 'callout', dataCallout: kind, dataHue: HUES[kind] ?? 'note' };
  const bodyNode = body.length > 0 ? [element('div', { class: 'callout-body' }, body)] : [];

  quote.type = 'callout';
  if (fold) {
    // Foldable callouts are native <details>, so they work without JavaScript.
    quote.data = { hName: 'details', hProperties: { ...properties, open: fold === '+' ? true : undefined } };
    quote.children = [element('summary', { class: 'callout-title' }, titleChildren), ...bodyNode];
  } else {
    quote.data = { hName: 'div', hProperties: properties };
    quote.children = [element('div', { class: 'callout-title' }, titleChildren), ...bodyNode];
  }
}

/** Turns `> [!type] Title` blockquotes into callouts, including nested ones. */
export function transformCallouts(tree: Node, context: Context): void {
  walk(tree, (node) => {
    if (node.type === 'blockquote') toCallout(node, context);
  });
}
