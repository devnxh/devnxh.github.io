/**
 * Small mdast helpers shared by the vault index and the remark plugins.
 *
 * The plugins create custom node types (figures, callouts, embeds), so they work
 * on a loose node shape instead of the closed unions in `@types/mdast`.
 */
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
  // mdast nodes carry type-specific fields (url, depth, lang, identifier, ...).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/** Parses Markdown the same way the site does (CommonMark + GFM + maths). */
export function parseMarkdown(source: string): Node {
  return parser.parse(source) as unknown as Node;
}

/** Nodes whose content is literal and must never be scanned for Obsidian syntax. */
export const LITERAL = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'html', 'yaml']);

export function text(value: string): Node {
  return { type: 'text', value };
}

/** A custom element that remark-rehype turns into `<tag ...props>children</tag>`. */
export function element(
  tag: string,
  properties: Record<string, unknown>,
  children: Node[] = [],
  type = 'obsidian',
): Node {
  return { type, data: { hName: tag, hProperties: properties }, children };
}

export function html(value: string): Node {
  return { type: 'html', value };
}

/** Visits every node depth-first. Return `false` from the visitor to skip a node's children. */
export function walk(
  node: Node,
  visitor: (node: Node, parent: Node | undefined) => boolean | void,
  parent?: Node,
): void {
  if (visitor(node, parent) === false) return;
  for (const child of [...(node.children ?? [])]) walk(child, visitor, node);
}

/**
 * Rewrites text nodes. `replace` returns the nodes that take the text node's
 * place, or `undefined` to leave it alone. Literal nodes and any node type in
 * `skip` are not entered.
 */
export function rewriteText(
  tree: Node,
  skip: ReadonlySet<string>,
  replace: (value: string, parent: Node) => Node[] | undefined,
): void {
  const visit = (parent: Node): void => {
    if (!parent.children) return;
    const next: Node[] = [];
    for (const child of parent.children) {
      if (child.type === 'text') {
        next.push(...(replace(child.value ?? '', parent) ?? [child]));
        continue;
      }
      if (!LITERAL.has(child.type) && !skip.has(child.type)) visit(child);
      next.push(child);
    }
    parent.children = next;
  };
  visit(tree);
}

/** Concatenated text of a node, including inline code and maths. */
export function textOf(node: Node): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** True when a paragraph holds nothing but whitespace around a single child. */
export function onlyChild(paragraph: Node): Node | undefined {
  const meaningful = (paragraph.children ?? []).filter(
    (child) => !(child.type === 'text' && !(child.value ?? '').trim()),
  );
  return meaningful.length === 1 ? meaningful[0] : undefined;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
