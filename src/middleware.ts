/**
 * German pages can show an English note when no translation exists. That note
 * was rendered with English URLs, so its internal links are pointed at the
 * German pages here. Links are recognised by the `data-wl` attribute the
 * wikilink plugin adds.
 */
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!/^\/de(\/|$)/.test(context.url.pathname)) return response;
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const html = await response.text();
  const rewritten = html.replace(/<a\b[^>]*\bdata-wl=[^>]*>/g, (tag) =>
    tag.replace(/\bhref="\/(?!de\/)/, 'href="/de/'),
  );
  return new Response(rewritten, { status: response.status, headers: response.headers });
});
