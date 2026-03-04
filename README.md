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
- **Admin Dashboard MVP copy asset:**
  - Greek UI copy for auth gate, moderation queue labels, status chips, empty/error states, and basic analytics labels
  - Source file: `data/admin-dashboard-copy.json`
- **Messaging MVP slice:**
  - Message request form on each professional profile
  - Submission endpoint at `POST /api/messages/submit` (participant guardrails + block checks)
  - Thread list view at `/messages?viewerEmail=...` with latest preview + unread count
  - Thread view at `/messages/thread?threadId=...&viewerEmail=...` with chronological history and report action
  - Read-state endpoint at `POST /api/messages/read` (participant-only)
  - Thread triage queue + open report actions at `/professionals/messages-moderation?key=...`
  - Triage endpoint at `POST /api/messages/triage` (`review`/`reject`/`block` actions logged)
  - Message report endpoint at `POST /api/messages/report` (strict participant-only)
  - Admin report actions endpoint at `POST /api/messages/reports-action` (`hide_message`/`dismiss_report`)
  - Admin hide endpoint at `POST /api/messages/hide`
  - Persistence files: `data/message-submissions.ndjson`, `data/message-triage-actions.ndjson`, `data/message-read-state.ndjson`, `data/message-reports.ndjson`, `data/message-report-actions.ndjson`, `data/message-visibility-actions.ndjson`
- **Admin Dashboard MVP shell:**
  - Protected overview at `/admin?key=...`
  - Queue cards for pending profiles, reviews, bookings, and message threads
  - Direct links into existing moderation surfaces

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

- `PROFESSIONAL_MODERATION_KEY` (required to access/operate `/admin`, `/professionals/moderation`, `/professionals/reviews-moderation`, `/professionals/bookings-moderation`, and `/professionals/messages-moderation`)
