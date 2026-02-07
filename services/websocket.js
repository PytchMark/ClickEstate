const { Server } = require('socket.io');
const { verifyToken } = require('./auth');

let io = null;

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.user.realtor_id || socket.user.username} (${socket.user.role})`);
    
    // Join room based on role
    if (socket.user.role === 'platform_admin') {
      socket.join('admin');
    } else if (socket.user.agency_id) {
      socket.join(`agency:${socket.user.agency_id}`);
      socket.join(`realtor:${socket.user.realtor_id}`);
    }

    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${socket.user.realtor_id || socket.user.username}`);
    });
  });

  console.log('[WS] Socket.io initialized');
  return io;
}

function getIO() {
  return io;
}

function emitNewRequest(request) {
  if (!io) return;
  
  // Notify specific realtor
  io.to(`realtor:${request.realtor_id}`).emit('new_request', {
    type: 'new_request',
    request,
    message: `New viewing request from ${request.customer_name}`
  });
  
  // Notify agency
  io.to(`agency:${request.agency_id}`).emit('agency_request', {
    type: 'new_request',
    request
  });
  
  // Notify admin
  io.to('admin').emit('admin_request', {
    type: 'new_request',
    request
  });
}

function emitRequestUpdate(request) {
  if (!io) return;
  
  io.to(`realtor:${request.realtor_id}`).emit('request_update', {
    type: 'request_update',
    request,
    message: `Request ${request.request_id} updated to ${request.status}`
  });
}

function emitListingUpdate(listing, action) {
  if (!io) return;
  
  io.to(`agency:${listing.agency_id}`).emit('listing_update', {
    type: 'listing_update',
    listing,
    action,
    message: `Listing ${listing.listing_id} ${action}`
  });
}

module.exports = { initializeSocket, getIO, emitNewRequest, emitRequestUpdate, emitListingUpdate };
