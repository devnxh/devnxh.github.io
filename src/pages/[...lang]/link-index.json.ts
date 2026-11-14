import type { APIRoute } from 'astro';
import { langFromParam, staticLangPaths } from '../../i18n';
import { getLinkIndex } from '../../lib/content';

export const getStaticPaths = staticLangPaths;

/** Title and first paragraph of every note, fetched by the hover previews. */
export const GET: APIRoute = async ({ params }) =>
  new Response(JSON.stringify(await getLinkIndex(langFromParam(params.lang))), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
