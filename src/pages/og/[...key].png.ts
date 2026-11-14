/**
 * One share image per page, generated at build time. The key mirrors the page
 * path: `/writeups/blue/` → `/og/writeups/blue.png`, Home → `/og/index.png`.
 */
import type { APIRoute } from 'astro';
import { LANGS, useTranslations } from '../../i18n';
import { getProjects, getWriteups } from '../../lib/content';
import { renderOgImage, type OgCard } from '../../lib/og';
import { site } from '../../site.config';

export async function getStaticPaths() {
  const paths: Array<{ params: { key: string }; props: OgCard }> = [];
  for (const lang of LANGS) {
    const t = useTranslations(lang);
    const prefix = lang === 'en' ? '' : `${lang}/`;
    const add = (key: string, kicker: string, title: string): void => {
      paths.push({ params: { key: `${prefix}${key}`.replace(/\/$/, '') || 'index' }, props: { kicker, title } });
    };

    add(lang === 'en' ? 'index' : '', site.status[lang].split(' · ')[0] ?? '', site.positioning[lang]);
    add('projects', site.name, t('projects.title'));
    add('writeups', site.name, t('writeups.title'));
    add('tags', site.name, t('tags.title'));
    add('about', site.targetRoles.join(' · '), `${t('about.title')}: ${site.name}`);
    for (const project of await getProjects(lang)) {
      add(`projects/${project.slug}`, `${t('exhibit')} ${project.exhibit} · ${t('type.projects')}`, project.title);
    }
    for (const writeup of await getWriteups(lang)) {
      add(`writeups/${writeup.slug}`, `${writeup.caseId} · ${t(`category.${writeup.category}`)}`, writeup.title);
    }
  }
  return paths;
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOgImage(props as OgCard)), { headers: { 'Content-Type': 'image/png' } });
