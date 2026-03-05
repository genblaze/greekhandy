import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = new URL('https://greekhandy.gr');
  const sitemapUrl = new URL('/sitemap.xml', site).toString();
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemapUrl}`
  ].join('\n').concat('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
