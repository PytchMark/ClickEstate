# ClickEstate — Powered by Pytch Marketing LLC

ClickEstate is a multi-tenant real estate SaaS: premium storefront + realtor operating system + platform admin console.

## What is included (v1)
- **Public Storefront** (`/storefront`): search listings by agency IDs (up to 3), view listing cards/details, submit viewing requests.
- **Realtor Portal** (`/realtor`): two-phase login, SaaS shell (sidebar + content), manage listings/media, pipeline/request updates, KPI summary.
- **Admin Portal** (`/admin`): env-based admin login, summary metrics, agency/realtor creation, reset password, search/filter/pagination-friendly APIs.
- **API + Security**: Express routes, JWT auth, role middlewares, CORS from env, helmet, morgan logs, rate limit, `/health` endpoint.
- **Cloudinary**: server-side media upload route and plan-limit enforcement.
- **Cloud Run ready**: Dockerfile and environment-driven configuration.

## Local development
1. Copy envs:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start server:
   ```bash
   npm start
   ```
4. Open apps:
   - http://localhost:8080/storefront
   - http://localhost:8080/realtor
   - http://localhost:8080/admin

## Required environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (**mandatory**; server refuses boot if missing)
- `ADMIN_EMAIL` or `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_API_KEY` (optional bypass header)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (optional template: `clickestate/agencies/{agencyId}/listings/{listingId}`)
- `CORS_ORIGINS` (comma-separated)

## Supabase SQL schema (copy/paste)
```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('realtor','agency_admin','platform_admin')) default 'realtor',
  agency_id text not null,
  realtor_id text not null,
  profile_email text,
  password text,
  display_name text,
  phone text,
  whatsapp text,
  status text not null check (status in ('active','paused')) default 'active',
  branding_tier text not null check (branding_tier in ('starter','pro','unlimited','standard','custom_brand')) default 'starter',
  logo_url text,
  primary_color text default '#ff3b30',
  created_at timestamptz default now(),
  unique(agency_id, realtor_id)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  listing_id text unique,
  agency_id text not null,
  realtor_id text not null,
  title text,
  address text,
  parish text,
  community text,
  price numeric,
  property_type text,
  bedrooms int,
  bathrooms int,
  sqft int,
  lot_size text,
  status text not null check (status in ('available','under_offer','sold','archived')) default 'available',
  description text,
  features text,
  image_urls text,
  video_url text,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text unique,
  agency_id text not null,
  realtor_id text not null,
  listing_id text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  request_type text not null check (request_type in ('whatsapp','live_video','walk_in','call')) default 'whatsapp',
  status text not null check (status in ('new','contacted','booked','closed','no_show')) default 'new',
  preferred_date text,
  preferred_time text,
  notes text,
  source text default 'storefront',
  created_at timestamptz default now()
);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  media_url text not null,
  media_type text check (media_type in ('image','video')),
  created_at timestamptz default now()
);

create index if not exists idx_profiles_agency_id on public.profiles(agency_id);
create index if not exists idx_profiles_realtor_id on public.profiles(realtor_id);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_created_at on public.profiles(created_at);

create index if not exists idx_listings_agency_id on public.listings(agency_id);
create index if not exists idx_listings_realtor_id on public.listings(realtor_id);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_created_at on public.listings(created_at);

create index if not exists idx_requests_agency_id on public.viewing_requests(agency_id);
create index if not exists idx_requests_realtor_id on public.viewing_requests(realtor_id);
create index if not exists idx_requests_status on public.viewing_requests(status);
create index if not exists idx_requests_created_at on public.viewing_requests(created_at);

alter table public.profiles disable row level security;
alter table public.listings disable row level security;
alter table public.viewing_requests disable row level security;
```

## API endpoints
- Public: `/api/public/...`
- Realtor: `/api/realtor/...`
- Admin: `/api/admin/...`
- Media: `POST /api/media/upload`

All responses follow `{ ok: true, ... }` or `{ ok: false, error: '...' }`.

## Cloudinary setup
1. Create cloud and API key/secret.
2. Put credentials in `.env`.
3. Upload media from Realtor portal listing manager (file picker).
4. URLs persist to `listings.image_urls` and `listings.video_url`.

## Deploy to Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/clickestate
gcloud run deploy clickestate \
  --image gcr.io/PROJECT_ID/clickestate \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,JWT_SECRET=...,ADMIN_USERNAME=...,ADMIN_PASSWORD=...,CLOUDINARY_CLOUD_NAME=...,CLOUDINARY_API_KEY=...,CLOUDINARY_API_SECRET=..."
```

## Manual smoke test checklist
1. Admin login works with env credentials.
2. Admin creates agency + realtor credentials.
3. Realtor login works from `/realtor`.
4. Realtor creates listing and uploads image/video.
5. Storefront loads same listing by agency IDs.
6. Storefront submits viewing request.
7. Request appears in realtor portal and admin requests feed.

## Notes
- Frontends are vanilla HTML/CSS/JS (no React).
- Auth passwords are plain in `profiles.password` for v1 only; hashing can be added in `services/auth.js` and login flow later.
