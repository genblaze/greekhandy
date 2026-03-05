import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type') || '';

  if (contentType.toLowerCase().includes('text/html') && !/charset\s*=\s*utf-8/i.test(contentType)) {
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
};
