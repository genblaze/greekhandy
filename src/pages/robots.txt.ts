import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = 'https://greekhandy.gr';
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${site}/sitemap.xml`
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
