import type { APIRoute } from 'astro';

export const prerender = true;

const site = new URL('https://greekhandy.gr');

const toIso = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const toAbsoluteUrl = (pathname: string) => {
  const prefixedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(encodeURI(prefixedPath), site).toString();
};

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export const GET: APIRoute = async () => {
  const staticRoutes = ['/', '/blog', '/epikoinonia', '/professionals', '/politiki-aporritou'];

  const contentFiles = import.meta.glob('../../data/content/*.json', { eager: true });
  const contentRoutes = Object.values(contentFiles)
    .map((mod: any) => mod.default ?? mod)
    .filter((entry: any) => typeof entry?.slug === 'string')
    .map((entry: any) => ({
      loc: toAbsoluteUrl(entry.slug),
      lastmod: toIso(entry.updatedAt || entry.createdAt)
    }));

  let professionalRoutes: Array<{ loc: string; lastmod: string }> = [];
  try {
    const professionalsFile = await import('../../data/professionals.json');
    const professionals = (professionalsFile.default ?? professionalsFile) as any[];
    professionalRoutes = professionals
      .filter((p) => p?.approved === true && p?.published === true && typeof p?.slug === 'string')
      .map((p) => ({
        loc: toAbsoluteUrl(`professionals/${p.slug}`),
        lastmod: toIso(p.updatedAt || p.createdAt)
      }));
  } catch {
    professionalRoutes = [];
  }

  const allRoutes = [
    ...staticRoutes.map((route) => ({ loc: toAbsoluteUrl(route), lastmod: toIso() })),
    ...contentRoutes,
    ...professionalRoutes
  ];

  const unique = new Map<string, { loc: string; lastmod: string }>();
  for (const route of allRoutes) {
    unique.set(route.loc, route);
  }

  const urls = [...unique.values()]
    .map(({ loc, lastmod }) => [
      '<url>',
      `  <loc>${escapeXml(loc)}</loc>`,
      `  <lastmod>${escapeXml(lastmod)}</lastmod>`,
      '</url>'
    ].join('\n'))
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>'
  ].join('\n');

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
