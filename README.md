# GreekHandy

Marketplace-style directory for home services in Greece, built with Astro + Tailwind.

## Current MVP Features

- Service/category SEO pages from JSON content
- Homepage search + browse + city filters
- **Contact Forms MVP:**
  - Per-service lead form (`name`, `phone`, `email`, `description`)
  - Server endpoint at `POST /api/contact`
  - Thank-you flow at `/thank-you`
  - Lead persistence to `data/contact-submissions.ndjson`
  - Admin email notification via SMTP (when configured)
- **Professional Profiles MVP slice:**
  - Professionals directory at `/professionals`
  - Individual profile pages at `/professionals/[slug]`
  - Profile includes bio, services, areas served, contact info

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Contact Form Environment Variables

Set these to enable admin email notifications:

- `CONTACT_ADMIN_EMAIL` (default: `info@greekhandy.gr`)
- `CONTACT_FROM_EMAIL` (optional; defaults to SMTP user)
- `SMTP_HOST`
- `SMTP_PORT` (default: `587`)
- `SMTP_USER`
- `SMTP_PASS`

If SMTP is not configured, submissions are still saved to `data/contact-submissions.ndjson` and the app redirects users to the thank-you page.
