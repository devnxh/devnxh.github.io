import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { langFromParam, staticLangPaths, useTranslations } from '../../i18n';
import { getWriteups } from '../../lib/content';
import { site } from '../../site.config';

export const getStaticPaths = staticLangPaths;

/** One feed per language: `/rss.xml` and `/de/rss.xml`. */
export const GET: APIRoute = async ({ params }) => {
  const lang = langFromParam(params.lang);
  const t = useTranslations(lang);
  const writeups = await getWriteups(lang);
  return rss({
    title: t('rss.title'),
    description: site.description[lang],
    site: site.url,
    customData: `<language>${lang === 'de' ? 'de-DE' : 'en-GB'}</language>`,
    items: writeups.map((writeup) => ({
      title: `${writeup.caseId} · ${writeup.title}`,
      description: writeup.description,
      pubDate: writeup.date,
      link: writeup.url,
      categories: [writeup.category, ...writeup.tags],
    })),
  });
};
