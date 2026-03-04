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
- **Professional Profiles MVP slices:**
  - Professionals directory at `/professionals`
  - Individual profile pages at `/professionals/[slug]`
  - Profile includes bio, services, areas served, contact info
  - Profile photos + portfolio gallery support
  - Professional registration page at `/professionals/register`
  - Registration endpoint at `POST /api/professionals/register`
  - Registration thank-you flow at `/professionals/thank-you`
  - Registration persistence to `data/professional-registrations.ndjson`
  - Basic moderation queue at `/professionals/moderation?key=...`
  - Moderation endpoint at `POST /api/professionals/moderate` (approve/reject)
  - Approval creates a draft profile (`approved: true`, `published: false`) in `data/professionals.json`
- **Reviews & Ratings MVP slices:**
  - Review submission form on each professional profile
  - Rating capture from 1 to 5
  - Submission endpoint at `POST /api/reviews/submit` (saved as pending)
  - Approved-only public review display with average rating on `/professionals/[slug]`
  - Review moderation queue at `/professionals/reviews-moderation?key=...`
  - Review moderation endpoint at `POST /api/reviews/moderate` (approve/reject)
  - Approved reviews stored in `data/reviews.json`
- **Booking Requests MVP slice:**
  - Booking request form on each professional profile
  - Submission endpoint at `POST /api/bookings/submit` (saved as `pending`)
  - Moderation queue at `/professionals/bookings-moderation?key=...`
  - Moderation endpoint at `POST /api/bookings/moderate` (approve/reject actions logged)
  - Submission persistence in `data/booking-submissions.ndjson` and action log in `data/booking-moderation-actions.ndjson`
- **Messaging MVP copy asset:**
  - Greek UI copy for conversation start, empty state, send failure, moderation/blocked notices, and thread status labels
  - Source file: `data/messaging-copy.json`
- **Messaging Requests MVP slice:**
  - Message request form on each professional profile
  - Submission endpoint at `POST /api/messages/submit` (saved as `pending`)
  - Thread triage queue at `/professionals/messages-moderation?key=...`
  - Triage endpoint at `POST /api/messages/triage` (`review`/`reject`/`block` actions logged)
  - Submission persistence in `data/message-submissions.ndjson` and action log in `data/message-triage-actions.ndjson`

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

## Professional Moderation Environment Variable

- `PROFESSIONAL_MODERATION_KEY` (required to access/operate `/professionals/moderation`, `/professionals/reviews-moderation`, `/professionals/bookings-moderation`, and `/professionals/messages-moderation`)
