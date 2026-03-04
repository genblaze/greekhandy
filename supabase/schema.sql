-- GreekHandy Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Contact form submissions (leads from website visitors)
create table if not exists contact_requests (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null,
  email text not null,
  description text not null,
  service_slug text,
  service_name text,
  page_url text,
  status text default 'new' check (status in ('new', 'contacted', 'converted', 'closed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Professionals (workers who join the platform)
create table if not exists professionals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  name text not null,
  business_name text,
  phone text not null,
  email text not null,
  city text not null,
  region text,
  address text,
  bio text,
  avatar_url text,
  categories text[] default '{}',
  is_verified boolean default false,
  is_active boolean default true,
  rating_avg numeric(2,1) default 0,
  rating_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Reviews
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  professional_id uuid references professionals(id) on delete cascade,
  reviewer_name text not null,
  reviewer_email text,
  rating int not null check (rating between 1 and 5),
  comment text,
  service_slug text,
  verified boolean default false,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table reviews add column if not exists verified boolean default false;

-- 4. Bookings
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  professional_id uuid references professionals(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  service_slug text,
  service_name text,
  description text,
  preferred_date date,
  preferred_time text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid not null,
  sender_type text not null check (sender_type in ('customer', 'professional')),
  sender_name text not null,
  body text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_contact_requests_status on contact_requests(status);
create index if not exists idx_professionals_categories on professionals using gin(categories);
create index if not exists idx_professionals_city on professionals(city);
create index if not exists idx_reviews_professional on reviews(professional_id);
create index if not exists idx_reviews_status on reviews(status);
create index if not exists idx_bookings_professional on bookings(professional_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_messages_thread on messages(thread_id, created_at);

-- Row Level Security
alter table contact_requests enable row level security;
alter table professionals enable row level security;
alter table reviews enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;

-- Public read for professionals and approved reviews
create policy "Anyone can view active professionals" on professionals
  for select using (is_active = true);

create policy "Anyone can view approved reviews" on reviews
  for select using (status = 'approved');

-- Anyone can submit contact requests, reviews, bookings
create policy "Anyone can submit contact requests" on contact_requests
  for insert with check (true);

create policy "Anyone can submit reviews" on reviews
  for insert with check (true);

create policy "Anyone can submit bookings" on bookings
  for insert with check (true);

-- Anyone can send messages (for now — tighten later with auth)
create policy "Anyone can send messages" on messages
  for insert with check (true);

create policy "Anyone can read messages in their thread" on messages
  for select using (true);

-- 6. Message reports + moderation audit log (admin dashboard queue)
create table if not exists message_reports (
  id text primary key,
  thread_id text not null,
  message_id text not null,
  reporter_email text not null,
  reported_sender_email text,
  reason text not null check (reason in ('spam', 'abuse', 'harassment', 'other')),
  details text default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  reported_at timestamptz default now()
);

create table if not exists message_moderation_actions (
  id uuid default gen_random_uuid() primary key,
  report_id text,
  thread_id text not null,
  message_id text,
  action text not null check (action in ('hide_message', 'dismiss_report', 'block_sender', 'review', 'reject', 'block', 'hide_latest_message')),
  actor_identifier text not null,
  actor_role text not null default 'moderator',
  metadata jsonb default '{}'::jsonb,
  acted_at timestamptz default now()
);

create index if not exists idx_message_reports_status on message_reports(status, reported_at desc);
create index if not exists idx_message_reports_thread on message_reports(thread_id);
create index if not exists idx_message_moderation_actions_report on message_moderation_actions(report_id, acted_at desc);
create index if not exists idx_message_moderation_actions_thread on message_moderation_actions(thread_id, acted_at desc);

alter table message_reports enable row level security;
alter table message_moderation_actions enable row level security;

create policy "Anyone can insert message reports" on message_reports
  for insert with check (true);

create policy "Anyone can read message reports" on message_reports
  for select using (true);

create policy "Anyone can insert message moderation actions" on message_moderation_actions
  for insert with check (true);

create policy "Anyone can read message moderation actions" on message_moderation_actions
  for select using (true);

-- 7. Review moderation audit trail (idempotent approve/reject actions)
create table if not exists review_moderation_actions (
  id uuid default gen_random_uuid() primary key,
  review_id uuid not null references reviews(id) on delete cascade,
  action text not null check (action in ('approve', 'reject')),
  actor_identifier text not null,
  actor_role text not null default 'moderator',
  metadata jsonb default '{}'::jsonb,
  acted_at timestamptz default now()
);

create unique index if not exists uq_review_moderation_actions_review_id on review_moderation_actions(review_id);
create index if not exists idx_review_moderation_actions_actor on review_moderation_actions(actor_identifier, acted_at desc);

alter table review_moderation_actions enable row level security;

create policy "Anyone can insert review moderation actions" on review_moderation_actions
  for insert with check (true);

create policy "Anyone can read review moderation actions" on review_moderation_actions
  for select using (true);
