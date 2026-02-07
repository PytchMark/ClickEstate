# ClickEstate PRD - Product Requirements Document

## Project Overview
**Name:** ClickEstate — Powered by Pytch Marketing LLC  
**Type:** Multi-tenant Real Estate SaaS Platform  
**Version:** 2.0.0  
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
| Deployment | Docker, Google Cloud Run |

---

## What's Been Implemented (2026-02-07)

### ✅ Storefront Features
- [x] Premium video hero with parallax scrolling
- [x] Three.js particle background effects
- [x] GSAP scroll animations (fade-ins, slide-ins, staggered sequences)
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
- [x] Plan limit enforcement
- [x] CORS, Helmet, Rate limiting
- [x] Health endpoint

### ✅ Infrastructure
- [x] Dockerfile for Cloud Run
- [x] Comprehensive README with setup instructions
- [x] SQL schema for Supabase
- [x] .env.example with all variables
- [x] Shared CSS and JS utilities

---

## Prioritized Backlog

### P0 - Critical (Must Have)
- [ ] Connect real Supabase credentials
- [ ] Connect real Cloudinary credentials
- [ ] End-to-end testing with real data
- [ ] Production deployment to Cloud Run

### P1 - High Priority
- [ ] Password hashing (bcrypt)
- [ ] Email verification for new accounts
- [ ] Forgot password flow
- [ ] Listing image reordering
- [ ] Virtual tour video embed support (360° viewers)
- [ ] Pinned scroll sections with storytelling

### P2 - Medium Priority
- [ ] Horizontal scrolling showcase sections
- [ ] More 3D effects (parallax depth layers)
- [ ] WhatsApp Business API integration
- [ ] Calendar integration for bookings
- [ ] CRM export (Salesforce, HubSpot)
- [ ] Agency branding customization
- [ ] Custom domain support

### P3 - Nice to Have
- [ ] WebGL/Three.js property 3D models
- [ ] AI property description generator
- [ ] Market analytics dashboard
- [ ] Mortgage calculator
- [ ] Neighborhood insights
- [ ] Multi-language support

---

## Next Tasks List
1. Set up real Supabase project and configure credentials
2. Set up real Cloudinary account and configure credentials
3. Create seed data (test agencies, realtors, listings)
4. Deploy to Cloud Run
5. Add password hashing
6. Add pinned scroll sections to storefront
7. Add horizontal scrolling property showcase

---

## Notes
- Video hero URL provided by user: `https://res.cloudinary.com/dd8pjjxsm/video/upload/v1770419902/...`
- User chose GSAP for animations, CSS+Three.js for 3D effects
- All features requested: real-time notifications, analytics, email, comparison, virtual tour, SEO
