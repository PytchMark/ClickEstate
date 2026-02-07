# ClickEstate — Powered by Pytch Marketing LLC

> Premium Real Estate SaaS Platform: Digital Storefront + Lead Engine + Agent Portal

![ClickEstate](https://img.shields.io/badge/version-2.0.0-ff3b30) ![Node](https://img.shields.io/badge/node-%3E%3D18-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

ClickEstate is a production-grade, multi-tenant real estate SaaS platform designed for realtors and agencies. It provides:

- **Public Storefront** (`/storefront`): Premium property browsing experience with GSAP animations, Three.js effects, property comparison, and instant viewing requests
- **Realtor Portal** (`/realtor`): Full-featured agent dashboard with real-time notifications, analytics charts, listings management, and lead pipeline
- **Admin Portal** (`/admin`): Platform administration for managing agencies, users, and viewing platform-wide metrics

## Features

### 🏠 Storefront
- Video hero with parallax scrolling
- Three.js particle background effects
- GSAP scroll animations and reveals
- Property comparison tool (up to 4 properties)
- Advanced filtering (parish, type, beds, price)
- Image gallery with keyboard navigation
- Viewing request forms with multiple types
- WhatsApp integration
- Mobile-responsive design
- SEO optimized

### 👤 Realtor Portal
- Real-time WebSocket notifications
- Interactive analytics dashboard with Chart.js
- Listings CRUD with media upload
- Drag-and-drop image/video uploads to Cloudinary
- Lead pipeline (Kanban view)
- Request status management
- Profile settings
- Plan-based limits enforcement

### 🔧 Admin Portal
- Platform-wide analytics
- Agency/realtor management
- Bulk actions and CSV export
- Password reset functionality
- Real-time activity monitoring

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla HTML/CSS/JS, Tailwind CSS (CDN), GSAP, Three.js, Chart.js |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) |
| Media Storage | Cloudinary |
| Real-time | Socket.io |
| Email | Nodemailer |
| Deployment | Docker, Google Cloud Run |

## Project Structure

```
/
├── server.js                 # Express server with all API routes
├── package.json
├── Dockerfile
├── .env.example
├── services/
│   ├── supabase.js          # Database operations
│   ├── auth.js              # JWT authentication
│   ├── cloudinary.js        # Media upload
│   ├── websocket.js         # Real-time notifications
│   ├── email.js             # Email notifications
│   └── analytics.js         # Analytics calculations
├── apps/
│   ├── storefront/          # Public storefront
│   │   ├── index.html
│   │   ├── storefront.js
│   │   └── storefront.css
│   ├── realtor/             # Realtor portal
│   │   ├── index.html
│   │   ├── realtor.js
│   │   └── realtor.css
│   └── admin/               # Admin portal
│       ├── index.html
│       ├── admin.js
│       └── admin.css
└── public/
    └── assets/
        ├── css/shared.css
        └── js/
            ├── api.js
            ├── ui.js
            └── formatters.js
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required - Server will fail to start without these
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Admin credentials (platform admin login)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
ADMIN_EMAIL=admin@example.com
ADMIN_API_KEY=optional-bypass-key

# Cloudinary (for media uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=clickestate/agencies/{agencyId}/listings/{listingId}

# Optional
PORT=8080
CORS_ORIGINS=*
NODE_ENV=production

# Email notifications (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
SMTP_FROM=ClickEstate <noreply@clickestate.com>
```

## Supabase SQL Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles table (realtors & agencies)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('realtor', 'agency_admin', 'platform_admin')) DEFAULT 'realtor',
  agency_id TEXT NOT NULL,
  realtor_id TEXT NOT NULL,
  profile_email TEXT,
  password TEXT,
  display_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')) DEFAULT 'active',
  branding_tier TEXT NOT NULL CHECK (branding_tier IN ('starter', 'pro', 'unlimited', 'standard', 'custom_brand')) DEFAULT 'starter',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#ff3b30',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, realtor_id)
);

-- Listings table
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT UNIQUE,
  agency_id TEXT NOT NULL,
  realtor_id TEXT NOT NULL,
  title TEXT,
  address TEXT,
  parish TEXT,
  community TEXT,
  price NUMERIC,
  property_type TEXT,
  bedrooms INT,
  bathrooms INT,
  sqft INT,
  lot_size TEXT,
  status TEXT NOT NULL CHECK (status IN ('available', 'under_offer', 'sold', 'archived')) DEFAULT 'available',
  description TEXT,
  features TEXT,
  image_urls TEXT,
  video_url TEXT,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Viewing requests table
CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE,
  agency_id TEXT NOT NULL,
  realtor_id TEXT NOT NULL,
  listing_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('whatsapp', 'live_video', 'walk_in', 'call')) DEFAULT 'whatsapp',
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'booked', 'closed', 'no_show')) DEFAULT 'new',
  preferred_date TEXT,
  preferred_time TEXT,
  notes TEXT,
  source TEXT DEFAULT 'storefront',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_realtor_id ON public.profiles(realtor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_listings_agency_id ON public.listings(agency_id);
CREATE INDEX IF NOT EXISTS idx_listings_realtor_id ON public.listings(realtor_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_requests_agency_id ON public.viewing_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.viewing_requests(status);

-- Disable RLS for v1 (using service role key server-side)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests DISABLE ROW LEVEL SECURITY;
```

## API Endpoints

### Public API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/agency/:agencyId` | Get agency info |
| GET | `/api/public/agency/:agencyId/listings` | Get agency listings |
| GET | `/api/public/listings?agencyIds=...` | Get listings by agency IDs (up to 3) |
| GET | `/api/public/listing/:listingId` | Get single listing |
| GET | `/api/public/compare?ids=...` | Compare listings |
| GET | `/api/public/featured` | Get featured listings |
| POST | `/api/public/agency/:agencyId/requests` | Submit viewing request |

### Realtor API (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/realtor/login` | Login and get token |
| GET | `/api/realtor/me` | Get current profile |
| PATCH | `/api/realtor/profile` | Update profile |
| GET | `/api/realtor/listings` | Get my listings |
| POST | `/api/realtor/listings` | Create/update listing |
| POST | `/api/realtor/listings/:id/archive` | Archive listing |
| POST | `/api/realtor/listings/:id/toggle-featured` | Toggle featured |
| POST | `/api/media/upload` | Upload media files |
| POST | `/api/media/delete` | Delete media |
| GET | `/api/realtor/requests` | Get my requests |
| POST | `/api/realtor/requests/:id/status` | Update request status |
| GET | `/api/realtor/summary` | Get KPIs |
| GET | `/api/realtor/analytics` | Get detailed analytics |

### Admin API (requires admin JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/summary` | Platform summary |
| GET | `/api/admin/analytics` | Detailed analytics |
| GET | `/api/admin/agencies` | List agencies |
| POST | `/api/admin/agencies` | Create agency |
| PATCH | `/api/admin/agencies/:id` | Update agency |
| POST | `/api/admin/reset-password` | Reset password |
| GET | `/api/admin/listings` | All listings |
| GET | `/api/admin/requests` | All requests |

## Local Development

```bash
# 1. Clone the repository
git clone <repo-url>
cd clickestate

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your credentials

# 4. Start the server
npm start

# 5. Open in browser
# Storefront: http://localhost:8080/storefront
# Realtor Portal: http://localhost:8080/realtor
# Admin Portal: http://localhost:8080/admin
```

## Cloud Run Deployment

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/clickestate

# Deploy to Cloud Run
gcloud run deploy clickestate \
  --image gcr.io/PROJECT_ID/clickestate \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,JWT_SECRET=...,ADMIN_USERNAME=...,ADMIN_PASSWORD=...,CLOUDINARY_CLOUD_NAME=...,CLOUDINARY_API_KEY=...,CLOUDINARY_API_SECRET=..."
```

## Cloudinary Setup

1. Create a Cloudinary account at https://cloudinary.com
2. Go to Dashboard > Settings > API Keys
3. Copy Cloud Name, API Key, and API Secret to your `.env`
4. Media uploads are handled server-side with signed uploads

## Plan Limits

| Plan | Listings | Images/Listing | Videos/Listing |
|------|----------|----------------|----------------|
| Starter | 5 | 3 | 0 |
| Pro | 33 | 6 | 2 |
| Unlimited | ∞ | 12 | 3 |

## Test Checklist

- [ ] Admin login with env credentials
- [ ] Admin creates agency with realtor
- [ ] Realtor login works
- [ ] Realtor creates listing
- [ ] Realtor uploads images/video
- [ ] Storefront loads by agency ID
- [ ] Storefront filtering works
- [ ] Property comparison works
- [ ] Viewing request submits
- [ ] Real-time notification appears
- [ ] Request status updates
- [ ] Email notification sends (if SMTP configured)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - Pytch Marketing LLC

---

Built with ❤️ by Pytch Marketing LLC
