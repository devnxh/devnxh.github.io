import type { Node } from '../tree';

/**
 * Removes Obsidian comments, `%%like this%%`, inline and across blocks.
 *
 * The walk keeps one "inside a comment" flag in document order, so a comment
 * that opens in one paragraph and closes three blocks later takes everything
 * between with it, including code blocks. `%%` inside code is literal and does
 * not open or close a comment.
 */
export function removeComments(tree: Node): void {
  let open = false;

  const keep = (node: Node): boolean => {
    if (node.type === 'text') {
      let rest = node.value ?? '';
      let visible = '';
      for (;;) {
        const marker = rest.indexOf('%%');
        if (marker === -1) {
          if (!open) visible += rest;
          break;
        }
        if (!open) visible += rest.slice(0, marker);
        open = !open;
        rest = rest.slice(marker + 2);
      }
      node.value = visible;
      return visible.length > 0;
    }

    if (!node.children) return !open;

    const wasEmpty = node.children.length === 0;
    const startedOpen = open;
    node.children = node.children.filter(keep);
    if (node.children.length > 0) return true;
    // A container that lost every child to a comment goes too. One that was
    // empty to begin with (an empty table cell) stays unless it sits inside one.
    return wasEmpty && !startedOpen;
  };

  tree.children = (tree.children ?? []).filter(keep);
}
