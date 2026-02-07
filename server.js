require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { select, insert, update, assertSupabaseEnv } = require('./services/supabase');
const { signToken, requireAuth, requireRealtor, requireAdmin, assertJwtSecret } = require('./services/auth');
const { uploadBuffer } = require('./services/cloudinary');
const { buildRealtorSummary, buildAdminSummary, buildDetailedAnalytics } = require('./services/analytics');
const { initializeSocket, emitNewRequest, emitRequestUpdate, emitListingUpdate } = require('./services/websocket');
const { sendViewingRequestNotification, sendStatusUpdateNotification } = require('./services/email');

assertSupabaseEnv();
assertJwtSecret();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((v) => v.trim());
app.use(cors({ origin: corsOrigins.includes('*') ? true : corsOrigins }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 200 }));

app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/storefront', express.static(path.join(__dirname, 'apps/storefront')));
app.use('/realtor', express.static(path.join(__dirname, 'apps/realtor')));
app.use('/admin', express.static(path.join(__dirname, 'apps/admin')));
app.get('/', (_, res) => res.redirect('/storefront'));
app.get('/health', (_, res) => res.json({ ok: true, service: 'clickestate', timestamp: new Date().toISOString() }));

const tierLimits = {
  starter: { listings: 5, images: 3, videos: 0 },
  standard: { listings: 5, images: 3, videos: 0 },
  pro: { listings: 33, images: 6, videos: 2 },
  custom_brand: { listings: 33, images: 6, videos: 2 },
  unlimited: { listings: Infinity, images: 12, videos: 3 }
};
const getTier = (tier) => tierLimits[(tier || '').toLowerCase()] || tierLimits.pro;
const parseImageUrls = (raw) => { try { return Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { return []; } };
const requestId = () => `REQ-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const listingIdGen = () => `LST-${Date.now().toString().slice(-8)}`;

// ==================== PUBLIC API ====================

app.get('/api/public/agency/:agencyId', async (req, res) => {
  try {
    const rows = await select('profiles', `?agency_id=eq.${encodeURIComponent(req.params.agencyId)}&select=agency_id,display_name,logo_url,primary_color,phone,whatsapp,profile_email&limit=1`);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Agency not found' });
    return res.json({ ok: true, agency: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/public/agency/:agencyId/listings', async (req, res) => {
  try {
    const rows = await select('listings', `?agency_id=eq.${encodeURIComponent(req.params.agencyId)}&status=eq.available&order=featured.desc,created_at.desc`);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/public/listings', async (req, res) => {
  try {
    const agencyIds = (req.query.agencyIds || '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, 3);
    if (!agencyIds.length) return res.status(400).json({ ok: false, error: 'agencyIds query required' });
    const inQuery = agencyIds.map((id) => `"${id}"`).join(',');
    let query = `?agency_id=in.(${inQuery})&status=eq.available`;
    
    // Filtering
    if (req.query.parish) query += `&parish=eq.${encodeURIComponent(req.query.parish)}`;
    if (req.query.property_type) query += `&property_type=eq.${encodeURIComponent(req.query.property_type)}`;
    if (req.query.min_price) query += `&price=gte.${req.query.min_price}`;
    if (req.query.max_price) query += `&price=lte.${req.query.max_price}`;
    if (req.query.bedrooms) query += `&bedrooms=gte.${req.query.bedrooms}`;
    if (req.query.bathrooms) query += `&bathrooms=gte.${req.query.bathrooms}`;
    
    query += '&order=featured.desc,created_at.desc';
    const rows = await select('listings', query);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/public/listing/:listingId', async (req, res) => {
  try {
    const rows = await select('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&limit=1`);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Listing not found' });
    
    // Get realtor info for the listing
    const listing = rows[0];
    const realtors = await select('profiles', `?agency_id=eq.${listing.agency_id}&realtor_id=eq.${listing.realtor_id}&select=display_name,phone,whatsapp,logo_url&limit=1`);
    
    return res.json({ ok: true, listing: { ...listing, realtor: realtors[0] || null } });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Compare listings endpoint
app.get('/api/public/compare', async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 4);
    if (!ids.length) return res.status(400).json({ ok: false, error: 'ids query required' });
    const inQuery = ids.map((id) => `"${id}"`).join(',');
    const rows = await select('listings', `?listing_id=in.(${inQuery})`);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Featured listings for homepage
app.get('/api/public/featured', async (req, res) => {
  try {
    const rows = await select('listings', `?featured=eq.true&status=eq.available&order=created_at.desc&limit=6`);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/public/agency/:agencyId/requests', async (req, res) => {
  try {
    const payload = {
      request_id: requestId(),
      agency_id: req.params.agencyId,
      realtor_id: req.body.realtor_id || 'UNASSIGNED',
      listing_id: req.body.listing_id || null,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone,
      customer_email: req.body.customer_email || null,
      request_type: req.body.request_type || 'whatsapp',
      preferred_date: req.body.preferred_date || null,
      preferred_time: req.body.preferred_time || null,
      notes: req.body.notes || null,
      source: 'storefront'
    };
    if (!payload.customer_name || !payload.customer_phone) return res.status(400).json({ ok: false, error: 'Name and phone required' });
    
    const rows = await insert('viewing_requests', payload);
    const request = rows[0];
    
    // Emit real-time notification
    emitNewRequest(request);
    
    // Send email notification to realtor
    if (payload.realtor_id !== 'UNASSIGNED') {
      const realtors = await select('profiles', `?agency_id=eq.${payload.agency_id}&realtor_id=eq.${payload.realtor_id}&select=profile_email&limit=1`);
      if (realtors[0]?.profile_email) {
        sendViewingRequestNotification(request, realtors[0].profile_email);
      }
    }
    
    return res.json({ ok: true, request });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// ==================== REALTOR AUTH + API ====================

app.post('/api/realtor/login', async (req, res) => {
  try {
    const { agencyIdOrEmailOrRealtorId, password } = req.body;
    const value = encodeURIComponent(agencyIdOrEmailOrRealtorId || '');
    const rows = await select('profiles', `?or=(agency_id.eq.${value},profile_email.eq.${value},realtor_id.eq.${value})&status=eq.active&limit=1`);
    if (!rows.length || rows[0].password !== password) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const profile = rows[0];
    const token = signToken({ role: profile.role, agency_id: profile.agency_id, realtor_id: profile.realtor_id, profile_id: profile.id });
    return res.json({ ok: true, token, profile });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/realtor/me', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await select('profiles', `?id=eq.${req.user.profile_id}&limit=1`);
    return res.json({ ok: true, profile: rows[0] || null });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/realtor/profile', requireAuth, requireRealtor, async (req, res) => {
  try {
    const allowedFields = ['display_name', 'phone', 'whatsapp', 'logo_url', 'primary_color'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const rows = await update('profiles', `?id=eq.${req.user.profile_id}`, updates);
    return res.json({ ok: true, profile: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/realtor/listings', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await select('listings', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}&order=created_at.desc`);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/realtor/listings', requireAuth, requireRealtor, async (req, res) => {
  try {
    const payload = req.body;
    const existing = payload.listing_id
      ? await select('listings', `?listing_id=eq.${encodeURIComponent(payload.listing_id)}&agency_id=eq.${req.user.agency_id}&limit=1`)
      : [];
    if (!existing.length) {
      const profile = await select('profiles', `?id=eq.${req.user.profile_id}&select=branding_tier&limit=1`);
      const limits = getTier(profile[0]?.branding_tier);
      const count = await select('listings', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}&select=id`);
      if (count.length >= limits.listings) return res.status(403).json({ ok: false, error: 'Listing limit reached for your plan' });
      const newListing = {
        ...payload,
        listing_id: payload.listing_id || listingIdGen(),
        agency_id: req.user.agency_id,
        realtor_id: req.user.realtor_id,
        updated_at: new Date().toISOString()
      };
      const rows = await insert('listings', newListing);
      emitListingUpdate(rows[0], 'created');
      return res.json({ ok: true, listing: rows[0], mode: 'created' });
    }
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(payload.listing_id)}&agency_id=eq.${req.user.agency_id}`, {
      ...payload,
      updated_at: new Date().toISOString()
    });
    emitListingUpdate(rows[0], 'updated');
    return res.json({ ok: true, listing: rows[0], mode: 'updated' });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/realtor/listings/:listingId', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&agency_id=eq.${req.user.agency_id}`, { 
      status: 'archived', 
      updated_at: new Date().toISOString() 
    });
    if (rows[0]) emitListingUpdate(rows[0], 'archived');
    return res.json({ ok: true, listing: rows[0] || null });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/realtor/listings/:listingId/archive', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&agency_id=eq.${req.user.agency_id}`, { 
      status: 'archived', 
      updated_at: new Date().toISOString() 
    });
    if (rows[0]) emitListingUpdate(rows[0], 'archived');
    return res.json({ ok: true, listing: rows[0] || null });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Toggle featured status
app.post('/api/realtor/listings/:listingId/toggle-featured', requireAuth, requireRealtor, async (req, res) => {
  try {
    const existing = await select('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&agency_id=eq.${req.user.agency_id}&limit=1`);
    if (!existing.length) return res.status(404).json({ ok: false, error: 'Listing not found' });
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&agency_id=eq.${req.user.agency_id}`, { 
      featured: !existing[0].featured,
      updated_at: new Date().toISOString() 
    });
    return res.json({ ok: true, listing: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Media upload
app.post('/api/media/upload', requireAuth, requireRealtor, upload.array('media', 12), async (req, res) => {
  try {
    const listingId = req.body.listingId;
    const listing = await select('listings', `?listing_id=eq.${encodeURIComponent(listingId)}&agency_id=eq.${req.user.agency_id}&limit=1`);
    if (!listing.length) return res.status(404).json({ ok: false, error: 'Listing not found' });
    const profile = await select('profiles', `?id=eq.${req.user.profile_id}&select=branding_tier&limit=1`);
    const limits = getTier(profile[0]?.branding_tier);
    const currentImages = parseImageUrls(listing[0].image_urls);
    const currentVideos = listing[0].video_url ? (Array.isArray(listing[0].video_url) ? listing[0].video_url : [listing[0].video_url]) : [];
    const newImages = req.files.filter((f) => f.mimetype.startsWith('image/'));
    const newVideos = req.files.filter((f) => f.mimetype.startsWith('video/'));
    if (currentImages.length + newImages.length > limits.images) return res.status(403).json({ ok: false, error: `Plan allows max ${limits.images} images` });
    if (currentVideos.length + newVideos.length > limits.videos) return res.status(403).json({ ok: false, error: `Plan allows max ${limits.videos} videos` });
    const folder = (process.env.CLOUDINARY_FOLDER || 'clickestate/agencies/{agencyId}/listings/{listingId}')
      .replace('{agencyId}', req.user.agency_id).replace('{listingId}', listingId);

    const uploads = await Promise.all(req.files.map((file) => uploadBuffer({
      buffer: file.buffer,
      folder,
      resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
    })));
    const uploadedImages = uploads.filter((u) => u.resource_type === 'image').map((u) => u.secure_url);
    const uploadedVideos = uploads.filter((u) => u.resource_type === 'video').map((u) => u.secure_url);
    const nextImages = [...currentImages, ...uploadedImages];
    const nextVideos = [...currentVideos, ...uploadedVideos];
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(listingId)}&agency_id=eq.${req.user.agency_id}`, {
      image_urls: JSON.stringify(nextImages),
      video_url: nextVideos[0] || null,
      updated_at: new Date().toISOString()
    });
    return res.json({ ok: true, listing: rows[0], uploaded: uploads.map((u) => u.secure_url) });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Delete media from listing
app.post('/api/media/delete', requireAuth, requireRealtor, async (req, res) => {
  try {
    const { listingId, mediaUrl, mediaType } = req.body;
    const listing = await select('listings', `?listing_id=eq.${encodeURIComponent(listingId)}&agency_id=eq.${req.user.agency_id}&limit=1`);
    if (!listing.length) return res.status(404).json({ ok: false, error: 'Listing not found' });
    
    let updateData = { updated_at: new Date().toISOString() };
    if (mediaType === 'image') {
      const images = parseImageUrls(listing[0].image_urls).filter(url => url !== mediaUrl);
      updateData.image_urls = JSON.stringify(images);
    } else if (mediaType === 'video') {
      updateData.video_url = null;
    }
    
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(listingId)}&agency_id=eq.${req.user.agency_id}`, updateData);
    return res.json({ ok: true, listing: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/realtor/requests', requireAuth, requireRealtor, async (req, res) => {
  try {
    let query = `?agency_id=eq.${req.user.agency_id}`;
    // If not agency admin, filter by realtor_id
    if (req.user.role !== 'agency_admin') {
      query += `&realtor_id=eq.${req.user.realtor_id}`;
    }
    query += '&order=created_at.desc';
    const rows = await select('viewing_requests', query);
    return res.json({ ok: true, requests: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/realtor/requests/:requestId/status', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await update('viewing_requests', `?request_id=eq.${encodeURIComponent(req.params.requestId)}&agency_id=eq.${req.user.agency_id}`, { status: req.body.status });
    const updatedRequest = rows[0];
    if (updatedRequest) {
      emitRequestUpdate(updatedRequest);
      // Send email to customer if they provided email
      if (updatedRequest.customer_email) {
        sendStatusUpdateNotification(updatedRequest, updatedRequest.customer_email);
      }
    }
    return res.json({ ok: true, request: updatedRequest || null });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/realtor/summary', requireAuth, requireRealtor, async (req, res) => {
  try {
    const [listings, requests] = await Promise.all([
      select('listings', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}`),
      select('viewing_requests', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}`)
    ]);
    return res.json({ ok: true, ...buildRealtorSummary(listings, requests), topListings: listings.slice(0, 5) });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Detailed analytics for charts
app.get('/api/realtor/analytics', requireAuth, requireRealtor, async (req, res) => {
  try {
    const [listings, requests] = await Promise.all([
      select('listings', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}`),
      select('viewing_requests', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}`)
    ]);
    return res.json({ ok: true, analytics: buildDetailedAnalytics(listings, requests) });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// ==================== ADMIN API ====================

app.post('/api/admin/login', (req, res) => {
  const validUser = req.body.username === process.env.ADMIN_USERNAME || req.body.username === process.env.ADMIN_EMAIL;
  const validPass = req.body.password && req.body.password === process.env.ADMIN_PASSWORD;
  if (!validUser || !validPass) return res.status(401).json({ ok: false, error: 'Invalid admin credentials' });
  const token = signToken({ role: 'platform_admin', username: req.body.username });
  return res.json({ ok: true, token });
});

app.get('/api/admin/summary', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [profiles, listings, requests] = await Promise.all([select('profiles', '?select=*'), select('listings', '?select=*'), select('viewing_requests', '?select=*')]);
    return res.json({ ok: true, summary: buildAdminSummary(profiles, listings, requests) });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [profiles, listings, requests] = await Promise.all([
      select('profiles', '?select=*'),
      select('listings', '?select=*'),
      select('viewing_requests', '?select=*')
    ]);
    return res.json({ ok: true, analytics: buildDetailedAnalytics(listings, requests, profiles) });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/agencies', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize || 25));
    const search = req.query.search || '';
    const status = req.query.status || '';
    const offset = (page - 1) * pageSize;
    const range = `&offset=${offset}&limit=${pageSize}`;
    let query = `?select=agency_id,realtor_id,display_name,profile_email,status,role,branding_tier,created_at,phone,whatsapp`;
    if (search) query += `&or=(agency_id.ilike.*${search}*,display_name.ilike.*${search}*,profile_email.ilike.*${search}*)`;
    if (status) query += `&status=eq.${status}`;
    query += `&order=created_at.desc${range}`;
    
    const rows = await select('profiles', query);
    const grouped = rows.reduce((acc, p) => {
      acc[p.agency_id] = acc[p.agency_id] || { agency_id: p.agency_id, members: [] };
      acc[p.agency_id].members.push(p);
      return acc;
    }, {});
    return res.json({ ok: true, page, pageSize, agencies: Object.values(grouped), total: rows.length });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/admin/agencies', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const payload = {
      role: body.role || 'agency_admin',
      agency_id: body.agency_id,
      realtor_id: body.realtor_id,
      profile_email: body.profile_email,
      password: body.password,
      display_name: body.display_name,
      phone: body.phone || null,
      whatsapp: body.whatsapp || null,
      branding_tier: body.branding_tier || 'starter',
      status: 'active'
    };
    const rows = await insert('profiles', payload);
    return res.json({ ok: true, profile: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/admin/agencies/:profileId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowedFields = ['status', 'branding_tier', 'display_name', 'phone', 'whatsapp'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const rows = await update('profiles', `?id=eq.${req.params.profileId}`, updates);
    return res.json({ ok: true, profile: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/admin/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { agency_id, realtor_id, profile_email, password } = req.body;
    if (!password) return res.status(400).json({ ok: false, error: 'password required' });
    const filter = agency_id && realtor_id
      ? `?agency_id=eq.${encodeURIComponent(agency_id)}&realtor_id=eq.${encodeURIComponent(realtor_id)}`
      : `?profile_email=eq.${encodeURIComponent(profile_email)}`;
    const rows = await update('profiles', filter, { password });
    return res.json({ ok: true, updated: rows.length });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/listings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const filters = [];
    if (req.query.agencyId) filters.push(`agency_id=eq.${encodeURIComponent(req.query.agencyId)}`);
    if (req.query.status) filters.push(`status=eq.${encodeURIComponent(req.query.status)}`);
    if (req.query.realtorId) filters.push(`realtor_id=eq.${encodeURIComponent(req.query.realtorId)}`);
    if (req.query.search) filters.push(`or=(title.ilike.*${req.query.search}*,listing_id.ilike.*${req.query.search}*)`);
    const query = `?${filters.join('&')}${filters.length ? '&' : ''}order=created_at.desc&limit=${Math.min(200, Number(req.query.limit || 50))}`;
    const rows = await select('listings', query);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const filters = [];
    if (req.query.agencyId) filters.push(`agency_id=eq.${encodeURIComponent(req.query.agencyId)}`);
    if (req.query.status) filters.push(`status=eq.${encodeURIComponent(req.query.status)}`);
    if (req.query.realtorId) filters.push(`realtor_id=eq.${encodeURIComponent(req.query.realtorId)}`);
    const query = `?${filters.join('&')}${filters.length ? '&' : ''}order=created_at.desc&limit=${Math.min(200, Number(req.query.limit || 50))}`;
    const rows = await select('viewing_requests', query);
    return res.json({ ok: true, requests: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.use((_, res) => res.status(404).json({ ok: false, error: 'Not found' }));

const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`ClickEstate running on ${port}`));
