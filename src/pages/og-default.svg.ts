import type { APIRoute } from 'astro';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">GreekHandy</title>
  <desc id="desc">GreekHandy - Βρείτε αξιόπιστους επαγγελματίες για κάθε εργασία στην Ελλάδα</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="120" r="180" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="1120" cy="540" r="160" fill="#ffffff" fill-opacity="0.06"/>
  <text x="88" y="250" fill="#ffffff" font-size="82" font-family="Inter, Arial, sans-serif" font-weight="700">GreekHandy</text>
  <text x="88" y="320" fill="#dbeafe" font-size="34" font-family="Inter, Arial, sans-serif">Υπηρεσίες για σπίτι &amp; επιχείρηση, σε όλη την Ελλάδα</text>
  <text x="88" y="382" fill="#e2e8f0" font-size="30" font-family="Inter, Arial, sans-serif">Βρες επαγγελματία. Κλείσε γρήγορα. Ξεκίνα άμεσα.</text>
  <rect x="88" y="438" width="390" height="62" rx="31" fill="#ffffff" fill-opacity="0.12"/>
  <text x="118" y="479" fill="#ffffff" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="600">greekhandy.gr</text>
</svg>`;

export const GET: APIRoute = () => {
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
