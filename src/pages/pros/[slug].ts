import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ params, redirect }) => {
  const slug = (params.slug || '').trim();
  const destination = slug ? `/professionals/${slug}` : '/professionals';
  return redirect(destination, 301);
};
