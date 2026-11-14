/**
 * `rehypeObsidian`: the HTML-side finishing touches.
 *
 * - collects the table of contents and gives each h2 its hex offset
 * - adds hover anchor links to headings
 * - wraps tables so they scroll sideways on small screens
 * - copies each footnote next to its reference as a sidenote (shown in the
 *   margin on wide screens; the list at the end is shown on narrow ones)
 */
export interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>;
  children?: HastNode[];
}

export interface TocEntry {
  depth: number;
  id: string;
  text: string;
  /** Present on h2 only. */
  offset?: string;
}

/** `0x0000`, `0x0040`, `0x0080` … one 64-byte step per section. */
export function hexOffset(index: number): string {
  return `0x${(index * 0x40).toString(16).toUpperCase().padStart(4, '0')}`;
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function hasClass(node: HastNode, name: string): boolean {
  const value = node.properties?.className ?? node.properties?.class;
  return Array.isArray(value) ? value.includes(name) : typeof value === 'string' && value.split(/\s+/).includes(name);
}

function visit(node: HastNode, visitor: (node: HastNode, parent: HastNode | undefined) => void, parent?: HastNode): void {
  visitor(node, parent);
  for (const child of [...(node.children ?? [])]) visit(child, visitor, node);
}

function withoutIds(node: HastNode): HastNode {
  const copy: HastNode = { ...node };
  if (copy.properties) {
    copy.properties = { ...copy.properties };
    delete copy.properties.id;
  }
  if (copy.children) copy.children = copy.children.map(withoutIds);
  return copy;
}

function addSidenotes(tree: HastNode): void {
  const notes = new Map<string, HastNode[]>();
  visit(tree, (node) => {
    if (node.tagName !== 'li' || typeof node.properties?.id !== 'string') return;
    if (!node.properties.id.startsWith('user-content-fn-')) return;
    const content: HastNode[] = [];
    for (const child of node.children ?? []) {
      if (child.tagName !== 'p') continue;
      if (content.length > 0) content.push({ type: 'text', value: ' ' });
      for (const inline of child.children ?? []) {
        if (inline.tagName === 'a' && inline.properties?.dataFootnoteBackref !== undefined) continue;
        content.push(withoutIds(inline));
      }
    }
    notes.set(node.properties.id, content);
  });
  if (notes.size === 0) return;

  const placed = new Set<string>();
  visit(tree, (node, parent) => {
    if (node.tagName !== 'sup' || !parent?.children) return;
    const reference = node.children?.find((child) => child.tagName === 'a' && child.properties?.dataFootnoteRef !== undefined);
    const target = String(reference?.properties?.href ?? '').replace(/^#/, '');
    const content = notes.get(target);
    if (!reference || !content || placed.has(target)) return;
    placed.add(target);
    const sidenote: HastNode = {
      type: 'element',
      tagName: 'span',
      // Search indexes the footnote list at the end, so the copy is skipped.
      properties: { className: ['sidenote'], role: 'note', dataPagefindIgnore: '' },
      children: [
        { type: 'element', tagName: 'span', properties: { className: ['sidenote-number'] }, children: [{ type: 'text', value: textContent(reference) }] },
        { type: 'text', value: ' ' },
        ...content,
      ],
    };
    parent.children.splice(parent.children.indexOf(node) + 1, 0, sidenote);
  });
}

interface VFileLike {
  data: { astro?: { frontmatter?: Record<string, unknown> }; [key: string]: unknown };
}

export function rehypeObsidian() {
  return (tree: unknown, file: VFileLike): void => {
    const root = tree as HastNode;
    const toc: TocEntry[] = [];
    let sections = 0;

    visit(root, (node, parent) => {
      const heading = /^h([2-4])$/.exec(node.tagName ?? '');
      if (heading && typeof node.properties?.id === 'string') {
        const entry: TocEntry = { depth: Number(heading[1]), id: node.properties.id, text: textContent(node).trim() };
        if (entry.depth === 2) {
          entry.offset = hexOffset(sections);
          node.properties.dataOffset = entry.offset;
          sections += 1;
        }
        toc.push(entry);
        node.children = [
          ...(node.children ?? []),
          { type: 'text', value: ' ' },
          {
            type: 'element',
            tagName: 'a',
            properties: { className: ['heading-anchor'], href: `#${entry.id}`, ariaLabel: `Permalink: ${entry.text}` },
            children: [{ type: 'text', value: '#' }],
          },
        ];
      }

      if (node.tagName === 'table' && parent?.children && !hasClass(parent, 'table-scroll')) {
        const wrapper: HastNode = {
          type: 'element',
          tagName: 'div',
          // Focusable so keyboard users can scroll a wide table.
          properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Table' },
          children: [node],
        };
        parent.children.splice(parent.children.indexOf(node), 1, wrapper);
      }
    });

    addSidenotes(root);

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.toc = toc;
  };
}
