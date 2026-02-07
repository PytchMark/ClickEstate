# ClickEstate PRD - Product Requirements Document

## Project Overview
**Name:** ClickEstate — Powered by Pytch Marketing LLC  
**Type:** Multi-tenant Real Estate SaaS Platform  
**Version:** 2.1.0  
**Last Updated:** 2026-02-07

## Problem Statement
Build a production-grade SaaS platform that serves as a "digital storefront + lead engine" for realtors and agencies, consisting of:
- Public Storefront for property browsing and viewing requests
- Realtor Portal for listings management and lead pipeline
- Admin Portal for platform-wide management

## User Personas
1. **Home Buyers/Renters** - Browse listings, compare properties, request viewings
2. **Real Estate Agents** - Manage listings, track leads, upload media, respond to requests
3. **Agency Admins** - Oversee agency realtors and listings
4. **Platform Admins** - Manage all agencies/realtors, view platform metrics
5. **Prospective Realtors** - Apply to join the platform as a realtor

## Core Requirements (Static)
- Multi-tenant architecture with agency/realtor isolation
- Vanilla HTML/CSS/JS frontend (NO React)
- Node.js + Express backend
- Supabase PostgreSQL database
- Cloudinary for media storage
- JWT authentication
- Real-time notifications via WebSocket
- Docker deployment for Google Cloud Run

## Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | HTML/CSS/JS, Tailwind (CDN), GSAP, Three.js, Chart.js |
| Backend | Node.js, Express.js, Socket.io, Nodemailer, OpenAI SDK |
| Database | Supabase (PostgreSQL) |
| Media | Cloudinary |
| AI | GPT-4o via Emergent Universal Key |
| Payments | Stripe |
| Deployment | Docker, Google Cloud Run |

---

## What's Been Implemented (2026-02-07)

### ✅ Storefront Features
- [x] Premium video hero with parallax scrolling
- [x] Three.js particle background effects
- [x] GSAP scroll animations (fade-ins, slide-ins, staggered sequences)
- [x] **Scroll animation fix** - Elements now stay visible after scrolling (toggleActions: 'play none none none')
- [x] Lenis smooth scrolling
- [x] Agency search by ID (supports up to 3 agencies)
- [x] Property filtering (parish, type, beds, price)
- [x] Property cards with 3D hover effects
- [x] Property comparison tool (up to 4 properties)
- [x] Image gallery with keyboard navigation
- [x] Viewing request forms (walk-in, video tour, WhatsApp, call)
- [x] WhatsApp integration
- [x] Trust badges and SEO meta tags
- [x] Mobile responsive design
- [x] Toast notifications
- [x] **Running Testimonial Banner** (infinite scroll)
- [x] **Interactive Mortgage Calculator** (sliders for price, downpayment, rate, term)
- [x] **"Become A Realtor" navigation button** - Links to application section
- [x] **Realtor Application Form** - Complete application form with fields for name, email, phone, experience, plan selection

### ✅ Realtor Portal Features
- [x] Two-phase login (login screen → app shell)
- [x] Sidebar navigation (GoHighLevel style)
- [x] Dashboard with KPI cards
- [x] Chart.js analytics (requests over time, status distribution)
- [x] Conversion funnel visualization
- [x] Listings CRUD with drawer interface
- [x] **AI Property Description Generator** (GPT-4o powered)
- [x] **AI Property Image Tagging** (auto-detect features from photos)
- [x] Media upload (drag-drop to Cloudinary)
- [x] Plan-based limits enforcement (Starter/Pro/Unlimited)
- [x] Lead pipeline (Kanban view)
- [x] Requests table with status updates
- [x] Profile settings management
- [x] Real-time WebSocket notifications
- [x] Toast notifications

### ✅ Realtor Signup Funnel
- [x] SaaS-style landing page with feature showcase
- [x] Dashboard preview section
- [x] Feature highlights with icons
- [x] **Pricing Plans** (Starter $29, Pro $79, Unlimited $199)
- [x] Running testimonials banner
- [x] Signup form with validation
- [x] **Stripe Payment Integration** (subscription checkout)
- [x] Success/cancel handling
- [x] GSAP scroll animations

### ✅ Admin Portal Features
- [x] Platform admin login (env-based credentials)
- [x] Overview dashboard with platform metrics
- [x] Chart.js analytics (requests, status distribution)
- [x] Agency/realtor management with search/filter
- [x] Create agency functionality
- [x] Password reset functionality
- [x] Status toggle (activate/pause accounts)
- [x] CSV export for agencies
- [x] All listings view with filters
- [x] All requests view with filters
- [x] Real-time notifications
- [x] **Realtor Applications Tab** - View and manage incoming realtor applications

### ✅ Backend Features
- [x] Express server with all API routes
- [x] JWT authentication with role-based access
- [x] Supabase database integration
- [x] Cloudinary media upload with signed URLs
- [x] WebSocket (Socket.io) for real-time events
- [x] Email notifications (Nodemailer)
- [x] **AI Description Generator** (OpenAI GPT-4o)
- [x] **AI Image Tagging** (OpenAI GPT-4o Vision)
- [x] **Stripe Payment Integration** (subscriptions)
- [x] **Realtor Applications API** (POST /api/public/realtor-applications, GET/PATCH /api/admin/realtor-applications)
- [x] Plan limit enforcement
- [x] CORS, Helmet, Rate limiting
- [x] Health endpoint

### ✅ Infrastructure
- [x] Dockerfile for Cloud Run
- [x] Comprehensive README with setup instructions
- [x] SQL schema for Supabase
- [x] .env.example with all variables
- [x] Shared CSS and JS utilities
- [x] Frontend proxy for K8s ingress routing

---

## Database Schema

### New Table: realtor_applications
```sql
CREATE TABLE realtor_applications (
  id SERIAL PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  agency_name TEXT,
  experience TEXT NOT NULL,
  interested_plan TEXT DEFAULT 'starter',
  message TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

---

## Prioritized Backlog

### P0 - Critical (Must Have)
- [ ] Connect real Supabase credentials
- [ ] Connect real Cloudinary credentials
- [ ] End-to-end testing with real data
- [ ] Production deployment to Cloud Run

### P1 - High Priority
- [ ] **AI-powered competitive analysis** to suggest listing prices for realtors
- [ ] Password hashing (bcrypt)
- [ ] Email verification for new accounts
- [ ] Forgot password flow
- [ ] Listing image reordering
- [ ] Virtual tour video embed support (360° viewers)
- [ ] Pinned scroll sections with storytelling

### P2 - Medium Priority
- [ ] **AI image analysis** for auto-generating property tags from photos
- [ ] Horizontal scrolling showcase sections
- [ ] More 3D effects (parallax depth layers)
- [ ] WhatsApp Business API integration
- [ ] Calendar integration for bookings
- [ ] CRM export (Salesforce, HubSpot)
- [ ] Agency branding customization
- [ ] Custom domain support

### P3 - Nice to Have
- [ ] WebGL/Three.js property 3D models
- [ ] Market analytics dashboard
- [ ] Neighborhood insights
- [ ] Multi-language support

---

## Next Tasks List
1. Set up real Supabase project and configure credentials
2. Create the realtor_applications table in Supabase
3. Set up real Cloudinary account and configure credentials
4. Create seed data (test agencies, realtors, listings)
5. Deploy to Cloud Run
6. Add password hashing
7. Implement AI competitive analysis feature

---

## Notes
- Video hero URL provided by user: `https://res.cloudinary.com/dd8pjjxsm/video/upload/v1770419902/...`
- User chose GSAP for animations, CSS+Three.js for 3D effects
- All features requested: real-time notifications, analytics, email, comparison, virtual tour, SEO
- **CDN Caching**: Preview environment may cache static files. Changes may take time to propagate to external URLs.
