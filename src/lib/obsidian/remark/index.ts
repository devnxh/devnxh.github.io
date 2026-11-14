/**
 * `remarkObsidian`: one remark plugin that makes a default Obsidian vault
 * render the way Obsidian shows it.
 *
 * The work is split into small transforms that run in a fixed order. The same
 * function is called again for the content of embedded notes, which is why it
 * is exported separately from the plugin.
 */
import { resolve } from 'node:path';
import type { Node } from '../tree';
import { getVault, type NoteFile, type Vault } from '../vault';
import { transformCallouts } from './callouts';
import { removeComments } from './comments';
import { createContext, type Context } from './context';
import { transformBlockIds, transformCode, transformHighlights, transformInlineFootnotes, transformTags } from './inline';
import { transformLinks } from './links';

export function transformTree(tree: Node, context: Context): void {
  removeComments(tree);
  transformCode(tree, context);
  transformCallouts(tree, context);
  transformInlineFootnotes(tree, context);
  transformBlockIds(tree, context);
  transformHighlights(tree);
  transformLinks(tree, context, transformTree);
  transformTags(tree, context);
}

export interface RemarkObsidianOptions {
  /** Where to get the vault index. Defaults to the site's own `vault/` folder. */
  vault?: () => Vault;
}

interface VFileLike {
  path?: string;
  data: { astro?: { frontmatter?: Record<string, unknown> }; [key: string]: unknown };
}

function findHost(vault: Vault, path: string | undefined): NoteFile | undefined {
  if (!path) return undefined;
  const wanted = resolve(path).toLowerCase();
  return vault.files.find((file) => resolve(file.abs).toLowerCase() === wanted);
}

/** Runs the transforms on a parsed tree. Used by the plugin and by the tests. */
export function renderObsidian(tree: Node, vault: Vault, host?: NoteFile): Context {
  const context = createContext(vault, host);
  transformTree(tree, context);
  tree.children = [...(tree.children ?? []), ...context.definitions];
  return context;
}

export function remarkObsidian(options: RemarkObsidianOptions = {}) {
  return (tree: unknown, file: VFileLike): void => {
    const vault = (options.vault ?? getVault)();
    const context = renderObsidian(tree as Node, vault, findHost(vault, file.path));
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    Object.assign(file.data.astro.frontmatter, context.flags);
  };
}
