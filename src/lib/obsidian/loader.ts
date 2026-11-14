import { glob, type Loader } from 'astro/loaders';
import { showHidden, vaultSignature } from './vault';

/**
 * Astro's `glob()` loader, pointed at one folder of the vault.
 *
 * Two changes on top of the stock loader:
 * - In production, files and folders that start with `_` are not loaded at all.
 * - Each entry's digest also covers the rest of the vault. A note is rendered
 *   with links and embeds resolved against other notes, so it has to be
 *   rendered again when any of them changes, not only when its own text does.
 */
export function vaultLoader(folder: string): Loader {
  const inner = glob({
    base: `./vault/${folder}`,
    pattern: showHidden() ? '**/*.md' : ['**/*.md', '!**/_*', '!**/_*/**'],
    // Keep the file name as the id. Slugs and languages are worked out by the vault index.
    generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
  });
  return {
    ...inner,
    name: 'obsidian-vault-loader',
    load: (context) =>
      inner.load({
        ...context,
        generateDigest: (data) =>
          context.generateDigest(typeof data === 'string' ? `${data}\n${vaultSignature()}` : { data, vault: vaultSignature() }),
      }),
  };
}
