require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { select, insert, update, assertSupabaseEnv } = require('./services/supabase');
const { signToken, requireAuth, requireRealtor, requireAdmin, assertJwtSecret } = require('./services/auth');
const { uploadBuffer } = require('./services/cloudinary');
const { buildRealtorSummary, buildAdminSummary } = require('./services/analytics');

assertSupabaseEnv();
assertJwtSecret();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((v) => v.trim());
app.use(cors({ origin: corsOrigins.includes('*') ? true : corsOrigins }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120 }));

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

// Public API
app.get('/api/public/agency/:agencyId', async (req, res) => {
  try {
    const rows = await select('profiles', `?agency_id=eq.${encodeURIComponent(req.params.agencyId)}&select=agency_id,display_name,logo_url,primary_color,phone,whatsapp&limit=1`);
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
    const rows = await select('listings', `?agency_id=in.(${inQuery})&status=eq.available&order=created_at.desc`);
    return res.json({ ok: true, listings: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/public/listing/:listingId', async (req, res) => {
  try {
    const rows = await select('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&limit=1`);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Listing not found' });
    return res.json({ ok: true, listing: rows[0] });
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
    return res.json({ ok: true, request: rows[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Realtor Auth + API
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
      const rows = await insert('listings', {
        ...payload,
        listing_id: payload.listing_id || listingIdGen(),
        agency_id: req.user.agency_id,
        realtor_id: req.user.realtor_id,
        updated_at: new Date().toISOString()
      });
      return res.json({ ok: true, listing: rows[0], mode: 'created' });
    }
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(payload.listing_id)}&agency_id=eq.${req.user.agency_id}`, {
      ...payload,
      updated_at: new Date().toISOString()
    });
    return res.json({ ok: true, listing: rows[0], mode: 'updated' });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/realtor/listings/:listingId/archive', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await update('listings', `?listing_id=eq.${encodeURIComponent(req.params.listingId)}&agency_id=eq.${req.user.agency_id}`, { status: 'archived', updated_at: new Date().toISOString() });
    return res.json({ ok: true, listing: rows[0] || null });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/media/upload', requireAuth, requireRealtor, upload.array('media', 8), async (req, res) => {
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

app.get('/api/realtor/requests', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await select('viewing_requests', `?agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}&order=created_at.desc`);
    return res.json({ ok: true, requests: rows });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/realtor/requests/:requestId/status', requireAuth, requireRealtor, async (req, res) => {
  try {
    const rows = await update('viewing_requests', `?request_id=eq.${encodeURIComponent(req.params.requestId)}&agency_id=eq.${req.user.agency_id}&realtor_id=eq.${req.user.realtor_id}`, { status: req.body.status });
    return res.json({ ok: true, request: rows[0] || null });
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

// Admin API
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

app.get('/api/admin/agencies', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize || 25));
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;
    const range = `&offset=${offset}&limit=${pageSize}`;
    const rows = await select('profiles', `?select=agency_id,realtor_id,display_name,profile_email,status,role,branding_tier,created_at${search ? `&or=(agency_id.ilike.*${search}*,display_name.ilike.*${search}*,profile_email.ilike.*${search}*)` : ''}&order=created_at.desc${range}`);
    const grouped = rows.reduce((acc, p) => {
      acc[p.agency_id] = acc[p.agency_id] || { agency_id: p.agency_id, members: [] };
      acc[p.agency_id].members.push(p);
      return acc;
    }, {});
    return res.json({ ok: true, page, pageSize, agencies: Object.values(grouped) });
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
app.listen(port, () => console.log(`ClickEstate running on ${port}`));
