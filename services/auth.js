const jwt = require('jsonwebtoken');

const JWT_EXPIRY = '8h';

function assertJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to boot without JWT_SECRET.');
  }
}

function signToken(payload) {
  assertJwtSecret();
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  assertJwtSecret();
  return jwt.verify(token, process.env.JWT_SECRET);
}

function getTokenFromHeader(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

function requireRealtor(req, res, next) {
  if (!req.user || !['realtor', 'agency_admin'].includes(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Realtor access required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const bypass = process.env.ADMIN_API_KEY && req.headers['x-admin-api-key'] === process.env.ADMIN_API_KEY;
  if (bypass) {
    req.user = { role: 'platform_admin' };
    return next();
  }
  if (!req.user || req.user.role !== 'platform_admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  next();
}

module.exports = { assertJwtSecret, signToken, verifyToken, requireAuth, requireRealtor, requireAdmin };
