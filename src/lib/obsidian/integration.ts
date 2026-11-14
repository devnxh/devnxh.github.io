/**
 * The Astro integration that ties the vault to the build:
 * - tells the vault index whether drafts and `_` files are visible (dev only)
 * - serves attachments under /attachments/ in dev and copies the ones in use to the build
 * - prints the vault warnings summary after a build
 * - writes `/.well-known/security.txt` with an expiry one year after the build
 */
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { buildReport, formatReport, servedAttachments } from './graph';
import { extensionOf } from './syntax';
import { attachmentUrl, buildVault, vaultRoot } from './vault';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
};

export interface ObsidianIntegrationOptions {
  /** Lines for security.txt. `Expires` and `Canonical` are added automatically. */
  securityTxt?: { contact: string[]; preferredLanguages?: string; site: string };
}

export function obsidian(options: ObsidianIntegrationOptions = {}): AstroIntegration {
  return {
    name: 'obsidian-vault',
    hooks: {
      'astro:config:setup': ({ command }) => {
        process.env.OBSIDIAN_INCLUDE_HIDDEN = command === 'dev' ? '1' : '';
      },
      // Dev: PDFs, audio and video are read straight from the vault.
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/attachments', (request, response, next) => {
          const requested = normalize(decodeURIComponent((request.url ?? '').split('?')[0] ?? '')).replace(/^[\\/]+/, '');
          // Never serve anything outside the vault.
          if (!requested || requested.split(/[\\/]/).includes('..')) return next();
          const root = vaultRoot();
          const file = [join(root, 'attachments', requested), join(root, requested)].find((path) => existsSync(path) && statSync(path).isFile());
          if (!file) return next();
          response.setHeader('Content-Type', CONTENT_TYPES[extensionOf(file)] ?? 'application/octet-stream');
          response.setHeader('Accept-Ranges', 'none');
          createReadStream(file).pipe(response);
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        // Build: only attachments a published note links to or embeds are copied.
        const published = buildVault(vaultRoot());
        for (const attachment of servedAttachments(published)) {
          const target = fileURLToPath(new URL(`.${decodeURI(attachmentUrl(attachment))}`, dir));
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(attachment.abs, target);
        }

        if (options.securityTxt) {
          const { contact, preferredLanguages, site } = options.securityTxt;
          const expires = new Date();
          expires.setUTCFullYear(expires.getUTCFullYear() + 1);
          const lines = [
            ...contact.map((value) => `Contact: ${value}`),
            `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
            ...(preferredLanguages ? [`Preferred-Languages: ${preferredLanguages}`] : []),
            `Canonical: ${site}/.well-known/security.txt`,
          ];
          const folder = fileURLToPath(new URL('./.well-known/', dir));
          mkdirSync(folder, { recursive: true });
          writeFileSync(`${folder}security.txt`, `${lines.join('\n')}\n`);
        }

        const summary = formatReport(buildReport(published));
        if (summary) logger.warn(`\n${summary}\n`);
        else logger.info('Vault check: every link and attachment resolves.');
      },
    },
  };
}
