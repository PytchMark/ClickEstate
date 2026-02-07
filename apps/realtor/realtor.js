// ==================== State Management ====================
let me = null;
let listings = [];
let requests = [];
let analytics = null;
let socket = null;
let notifications = [];
let charts = {};

// ==================== DOM Elements ====================
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const content = document.getElementById('content');
const sidebar = document.querySelector('.sidebar');

// ==================== Initialize ====================
async function init() {
  // Check for existing token
  if (Api.token) {
    try {
      const data = await Api.request('/api/realtor/me');
      me = data.profile;
      enterApp();
    } catch {
      Api.clearToken();
    }
  }
  
  // Login form handler
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Navigation handlers
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      loadTab(item.dataset.tab);
    });
  });
  
  // Logout handler
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Mobile sidebar
  document.getElementById('mobile-sidebar-btn')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  
  // Drawer handlers
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.querySelector('.drawer-overlay').addEventListener('click', closeDrawer);
  
  // Notifications dropdown
  document.getElementById('notifications-btn').addEventListener('click', () => {
    document.getElementById('notifications-dropdown').classList.toggle('hidden');
  });
  
  // Close notifications on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifications-btn') && !e.target.closest('#notifications-dropdown')) {
      document.getElementById('notifications-dropdown').classList.add('hidden');
    }
  });
}

// ==================== Authentication ====================
async function handleLogin(e) {
  e.preventDefault();
  
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  
  try {
    const data = await Api.request('/api/realtor/login', {
      method: 'POST',
      body: JSON.stringify({ agencyIdOrEmailOrRealtorId: user, password: pass })
    });
    
    Api.setToken(data.token);
    me = data.profile;
    enterApp();
    
  } catch (error) {
    showToast(error.message || 'Invalid credentials', 'error');
  }
}

function enterApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  
  // Update user info
  document.getElementById('user-name').textContent = me.display_name || me.realtor_id;
  document.getElementById('user-role').textContent = me.role === 'agency_admin' ? 'Agency Admin' : 'Realtor';
  
  // Initialize WebSocket
  initWebSocket();
  
  // Load initial data
  loadTab('dashboard');
}

function logout() {
  Api.clearToken();
  me = null;
  if (socket) socket.disconnect();
  location.reload();
}

// ==================== WebSocket ====================
function initWebSocket() {
  socket = io({ auth: { token: Api.token } });
  
  socket.on('connect', () => {
    console.log('[WS] Connected');
  });
  
  socket.on('new_request', (data) => {
    addNotification(data.message, 'request');
    showToast(data.message, 'success');
    updateRequestsBadge();
    
    // Refresh requests if on that tab
    if (document.querySelector('.nav-item.active')?.dataset.tab === 'requests' ||
        document.querySelector('.nav-item.active')?.dataset.tab === 'pipeline') {
      loadRequests();
    }
  });
  
  socket.on('request_update', (data) => {
    addNotification(data.message, 'update');
  });
  
  socket.on('listing_update', (data) => {
    addNotification(data.message, 'listing');
  });
  
  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });
}

// ==================== Notifications ====================
function addNotification(message, type) {
  const notification = {
    id: Date.now(),
    message,
    type,
    time: new Date(),
    read: false
  };
  
  notifications.unshift(notification);
  if (notifications.length > 20) notifications.pop();
  
  updateNotificationsUI();
  document.getElementById('notification-dot').classList.remove('hidden');
}

function updateNotificationsUI() {
  const list = document.getElementById('notifications-list');
  
  if (notifications.length === 0) {
    list.innerHTML = '<div class="p-4 text-center text-[#666]">No new notifications</div>';
    return;
  }
  
  list.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}">
      <div class="notification-icon">
        <i class="ph ph-${n.type === 'request' ? 'user-plus' : n.type === 'listing' ? 'house' : 'info'}"></i>
      </div>
      <div class="flex-1">
        <p class="text-sm">${n.message}</p>
        <p class="text-xs text-[#666] mt-1">${formatTimeAgo(n.time)}</p>
      </div>
    </div>
  `).join('');
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function updateRequestsBadge() {
  // Will be updated after loading requests
}

// ==================== Tab Loading ====================
async function loadTab(tab) {
  // Update active nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });
  
  // Close mobile sidebar
  sidebar.classList.remove('open');
  
  // Animation
  gsap.to(content, {
    opacity: 0,
    duration: 0.15,
    onComplete: async () => {
      switch(tab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'listings':
          await loadListings();
          break;
        case 'pipeline':
          await loadPipeline();
          break;
        case 'requests':
          await loadRequestsTab();
          break;
        case 'profile':
          await loadProfile();
          break;
      }
      
      gsap.to(content, { opacity: 1, duration: 0.3 });
    }
  });
}

// ==================== Dashboard ====================
async function loadDashboard() {
  try {
    const [summaryRes, analyticsRes] = await Promise.all([
      Api.request('/api/realtor/summary'),
      Api.request('/api/realtor/analytics')
    ]);
    
    analytics = analyticsRes.analytics;
    const { kpis, topListings } = summaryRes;
    
    content.innerHTML = `
      <div class="mb-8">
        <h1 class="font-clash font-bold text-2xl mb-2">Welcome back, ${me.display_name || me.realtor_id}</h1>
        <p class="text-[#a1a1aa]">Here's your performance overview</p>
      </div>
      
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-buildings"></i></div>
          <div class="kpi-value">${kpis.totalListings}</div>
          <div class="kpi-label">Total Listings</div>
          <div class="kpi-trend up"><i class="ph ph-arrow-up"></i> ${kpis.activeListings} active</div>
        </div>
        
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-users"></i></div>
          <div class="kpi-value">${kpis.totalRequests}</div>
          <div class="kpi-label">Total Requests</div>
          <div class="kpi-trend up"><i class="ph ph-arrow-up"></i> ${analytics?.recentActivity?.requests || 0} this week</div>
        </div>
        
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-check-circle"></i></div>
          <div class="kpi-value">${kpis.closedRequests}</div>
          <div class="kpi-label">Closed Deals</div>
        </div>
        
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-chart-line-up"></i></div>
          <div class="kpi-value">${kpis.conversionRate}%</div>
          <div class="kpi-label">Conversion Rate</div>
        </div>
      </div>
      
      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Requests Over Time</h3>
          </div>
          <canvas id="requests-chart" height="200"></canvas>
        </div>
        
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Request Status</h3>
          </div>
          <canvas id="status-chart" height="200"></canvas>
        </div>
      </div>
      
      <!-- Conversion Funnel -->
      <div class="chart-card mb-8">
        <div class="chart-header">
          <h3 class="chart-title">Conversion Funnel</h3>
        </div>
        <div class="grid grid-cols-4 gap-4 mt-4">
          ${Object.entries(analytics?.conversionFunnel || {}).map(([status, count]) => `
            <div class="text-center p-4 bg-[#121212] rounded-lg">
              <div class="font-clash font-bold text-2xl">${count}</div>
              <div class="text-[#a1a1aa] text-sm capitalize">${status}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Top Listings -->
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Your Listings</h3>
          <button onclick="loadTab('listings')" class="action-btn secondary">View All</button>
        </div>
        ${topListings.length ? `
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Featured</th>
                </tr>
              </thead>
              <tbody>
                ${topListings.slice(0, 5).map(l => `
                  <tr>
                    <td>
                      <div class="font-medium">${l.title || 'Untitled'}</div>
                      <div class="text-[#666] text-sm">${l.listing_id}</div>
                    </td>
                    <td class="font-clash font-semibold">${formatPrice(l.price)}</td>
                    <td><span class="status-badge ${l.status}">${l.status}</span></td>
                    <td>${l.featured ? '<i class="ph ph-star-fill text-yellow-500"></i>' : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ph ph-house"></i></div>
            <h3 class="font-semibold mb-2">No listings yet</h3>
            <p class="text-[#a1a1aa] mb-4">Create your first listing to get started</p>
            <button onclick="loadTab('listings')" class="action-btn primary">Create Listing</button>
          </div>
        `}
      </div>
    `;
    
    // Initialize charts
    initCharts();
    
  } catch (error) {
    content.innerHTML = `<div class="text-center py-20 text-red-500">${error.message}</div>`;
  }
}

function initCharts() {
  if (!analytics) return;
  
  // Destroy existing charts
  Object.values(charts).forEach(chart => chart.destroy());
  
  // Requests over time chart
  const requestsCtx = document.getElementById('requests-chart')?.getContext('2d');
  if (requestsCtx) {
    charts.requests = new Chart(requestsCtx, {
      type: 'line',
      data: {
        labels: analytics.dailyRequests.map(d => d.date.slice(5)),
        datasets: [{
          label: 'Requests',
          data: analytics.dailyRequests.map(d => d.count),
          borderColor: '#ff3b30',
          backgroundColor: 'rgba(255, 59, 48, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#262626' }, ticks: { color: '#666' } },
          y: { grid: { color: '#262626' }, ticks: { color: '#666' }, beginAtZero: true }
        }
      }
    });
  }
  
  // Status distribution chart
  const statusCtx = document.getElementById('status-chart')?.getContext('2d');
  if (statusCtx) {
    const statusData = analytics.requestsByStatus || {};
    charts.status = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusData),
        datasets: [{
          data: Object.values(statusData),
          backgroundColor: ['#ff3b30', '#2196f3', '#4caf50', '#00c853', '#9e9e9e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#a1a1aa', padding: 20 }
          }
        }
      }
    });
  }
}

// ==================== Listings ====================
async function loadListings() {
  try {
    const data = await Api.request('/api/realtor/listings');
    listings = data.listings;
    
    content.innerHTML = `
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-clash font-bold text-2xl mb-2">Listings Manager</h1>
          <p class="text-[#a1a1aa]">Manage your property listings</p>
        </div>
        <button onclick="openListingDrawer()" class="action-btn primary" data-testid="new-listing-btn">
          <i class="ph ph-plus"></i>
          New Listing
        </button>
      </div>
      
      ${listings.length ? `
        <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Price</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${listings.map(l => `
                  <tr>
                    <td>
                      <div class="flex items-center gap-3">
                        <div class="w-16 h-12 bg-[#1a1a1a] rounded overflow-hidden">
                          ${getListingImage(l)}
                        </div>
                        <div>
                          <div class="font-medium">${l.title || 'Untitled'}</div>
                          <div class="text-[#666] text-sm">${l.listing_id}</div>
                        </div>
                      </div>
                    </td>
                    <td class="font-clash font-semibold">${formatPrice(l.price)}</td>
                    <td class="text-[#a1a1aa]">
                      ${l.bedrooms || 0} bd • ${l.bathrooms || 0} ba • ${l.sqft || '—'} sqft
                    </td>
                    <td><span class="status-badge ${l.status}">${l.status}</span></td>
                    <td>
                      <button onclick="toggleFeatured('${l.listing_id}')" class="p-2 hover:bg-[#1a1a1a] rounded" data-testid="toggle-featured-${l.listing_id}">
                        <i class="ph ${l.featured ? 'ph-star-fill text-yellow-500' : 'ph-star text-[#666]'}"></i>
                      </button>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <button onclick="openListingDrawer('${l.listing_id}')" class="action-btn secondary" data-testid="edit-listing-${l.listing_id}">
                          <i class="ph ph-pencil"></i>
                        </button>
                        <button onclick="archiveListing('${l.listing_id}')" class="action-btn danger" data-testid="archive-listing-${l.listing_id}">
                          <i class="ph ph-archive"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="ph ph-house"></i></div>
          <h3 class="font-semibold mb-2">No listings yet</h3>
          <p class="text-[#a1a1aa] mb-4">Create your first property listing to get started</p>
          <button onclick="openListingDrawer()" class="action-btn primary">Create Listing</button>
        </div>
      `}
    `;
    
  } catch (error) {
    content.innerHTML = `<div class="text-center py-20 text-red-500">${error.message}</div>`;
  }
}

function getListingImage(listing) {
  try {
    const images = JSON.parse(listing.image_urls || '[]');
    if (images[0]) {
      return `<img src="${images[0]}" alt="" class="w-full h-full object-cover">`;
    }
  } catch {}
  return `<div class="w-full h-full flex items-center justify-center"><i class="ph ph-image text-[#444]"></i></div>`;
}

// ==================== Listing Drawer ====================
function openListingDrawer(listingId = null) {
  const listing = listingId ? listings.find(l => l.listing_id === listingId) : null;
  
  document.getElementById('drawer-title').textContent = listing ? 'Edit Listing' : 'New Listing';
  
  document.getElementById('drawer-body').innerHTML = `
    <form id="listing-form" class="space-y-6">
      <input type="hidden" id="form-listing-id" value="${listing?.listing_id || ''}">
      
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input type="text" id="form-title" class="form-input" value="${listing?.title || ''}" required data-testid="form-title">
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label">Price *</label>
          <input type="number" id="form-price" class="form-input" value="${listing?.price || ''}" required data-testid="form-price">
        </div>
        <div class="form-group">
          <label class="form-label">Property Type</label>
          <select id="form-type" class="form-input form-select" data-testid="form-type">
            <option value="">Select type</option>
            <option value="house" ${listing?.property_type === 'house' ? 'selected' : ''}>House</option>
            <option value="apartment" ${listing?.property_type === 'apartment' ? 'selected' : ''}>Apartment</option>
            <option value="condo" ${listing?.property_type === 'condo' ? 'selected' : ''}>Condo</option>
            <option value="villa" ${listing?.property_type === 'villa' ? 'selected' : ''}>Villa</option>
            <option value="land" ${listing?.property_type === 'land' ? 'selected' : ''}>Land</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Address</label>
        <input type="text" id="form-address" class="form-input" value="${listing?.address || ''}" data-testid="form-address">
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label">Parish</label>
          <input type="text" id="form-parish" class="form-input" value="${listing?.parish || ''}" data-testid="form-parish">
        </div>
        <div class="form-group">
          <label class="form-label">Community</label>
          <input type="text" id="form-community" class="form-input" value="${listing?.community || ''}" data-testid="form-community">
        </div>
      </div>
      
      <div class="grid grid-cols-3 gap-4">
        <div class="form-group">
          <label class="form-label">Bedrooms</label>
          <input type="number" id="form-beds" class="form-input" value="${listing?.bedrooms || ''}" data-testid="form-beds">
        </div>
        <div class="form-group">
          <label class="form-label">Bathrooms</label>
          <input type="number" id="form-baths" class="form-input" value="${listing?.bathrooms || ''}" data-testid="form-baths">
        </div>
        <div class="form-group">
          <label class="form-label">Sq Ft</label>
          <input type="number" id="form-sqft" class="form-input" value="${listing?.sqft || ''}" data-testid="form-sqft">
        </div>
      </div>
      
      <div class="form-group">
        <div class="flex items-center justify-between mb-2">
          <label class="form-label mb-0">Description</label>
          <button type="button" onclick="generateAIDescription()" class="text-sm text-primary hover:text-[#d63026] flex items-center gap-1" data-testid="ai-generate-btn">
            <i class="ph ph-sparkle"></i>
            Generate with AI
          </button>
        </div>
        <textarea id="form-description" rows="4" class="form-input" data-testid="form-description">${listing?.description || ''}</textarea>
        <div id="ai-loading" class="hidden mt-2 text-sm text-[#a1a1aa] flex items-center gap-2">
          <i class="ph ph-circle-notch animate-spin"></i>
          Generating description...
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Features (comma separated)</label>
        <input type="text" id="form-features" class="form-input" value="${listing?.features || ''}" placeholder="Pool, Garden, Garage..." data-testid="form-features">
      </div>
      
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="form-status" class="form-input form-select" data-testid="form-status">
          <option value="available" ${listing?.status === 'available' ? 'selected' : ''}>Available</option>
          <option value="under_offer" ${listing?.status === 'under_offer' ? 'selected' : ''}>Under Offer</option>
          <option value="sold" ${listing?.status === 'sold' ? 'selected' : ''}>Sold</option>
        </select>
      </div>
      
      ${listing ? `
        <div class="form-group">
          <label class="form-label">Media</label>
          <div class="media-upload-zone" id="media-zone" data-testid="media-upload-zone">
            <i class="ph ph-upload-simple text-3xl text-[#666] mb-2"></i>
            <p class="text-[#a1a1aa]">Drop files here or click to upload</p>
            <p class="text-[#666] text-sm mt-1">Images and videos supported</p>
            <input type="file" id="media-input" multiple accept="image/*,video/*" class="hidden">
          </div>
          <div id="media-preview" class="media-preview">
            ${renderMediaPreview(listing)}
          </div>
        </div>
      ` : '<p class="text-[#666] text-sm">Save the listing first to upload media</p>'}
      
      <div class="flex gap-3 pt-4">
        <button type="submit" class="action-btn primary flex-1" data-testid="save-listing-btn">
          <i class="ph ph-check"></i>
          Save Listing
        </button>
        <button type="button" onclick="closeDrawer()" class="action-btn secondary">Cancel</button>
      </div>
    </form>
  `;
  
  // Form submit handler
  document.getElementById('listing-form').addEventListener('submit', saveListing);
  
  // Media upload handlers
  if (listing) {
    const mediaZone = document.getElementById('media-zone');
    const mediaInput = document.getElementById('media-input');
    
    mediaZone.addEventListener('click', () => mediaInput.click());
    mediaZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mediaZone.classList.add('dragover');
    });
    mediaZone.addEventListener('dragleave', () => mediaZone.classList.remove('dragover'));
    mediaZone.addEventListener('drop', (e) => {
      e.preventDefault();
      mediaZone.classList.remove('dragover');
      handleMediaUpload(e.dataTransfer.files, listing.listing_id);
    });
    mediaInput.addEventListener('change', (e) => handleMediaUpload(e.target.files, listing.listing_id));
  }
  
  // Open drawer
  document.getElementById('listing-drawer').classList.add('open');
}

function renderMediaPreview(listing) {
  if (!listing) return '';
  
  let html = '';
  try {
    const images = JSON.parse(listing.image_urls || '[]');
    images.forEach((url, i) => {
      html += `
        <div class="media-preview-item">
          <img src="${url}" alt="Media ${i + 1}">
          <button class="remove-btn" onclick="deleteMedia('${listing.listing_id}', '${url}', 'image')">
            <i class="ph ph-x text-xs"></i>
          </button>
        </div>
      `;
    });
  } catch {}
  
  if (listing.video_url) {
    html += `
      <div class="media-preview-item">
        <video src="${listing.video_url}" class="w-full h-full object-cover"></video>
        <button class="remove-btn" onclick="deleteMedia('${listing.listing_id}', '${listing.video_url}', 'video')">
          <i class="ph ph-x text-xs"></i>
        </button>
      </div>
    `;
  }
  
  return html;
}

async function handleMediaUpload(files, listingId) {
  if (!files.length) return;
  
  const formData = new FormData();
  formData.append('listingId', listingId);
  Array.from(files).forEach(f => formData.append('media', f));
  
  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Api.token}` },
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error);
    
    showToast('Media uploaded successfully', 'success');
    
    // Refresh listings and re-open drawer
    await loadListings();
    openListingDrawer(listingId);
    
  } catch (error) {
    showToast(error.message || 'Upload failed', 'error');
  }
}

async function deleteMedia(listingId, mediaUrl, mediaType) {
  try {
    await Api.request('/api/media/delete', {
      method: 'POST',
      body: JSON.stringify({ listingId, mediaUrl, mediaType })
    });
    
    showToast('Media deleted', 'success');
    await loadListings();
    openListingDrawer(listingId);
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function closeDrawer() {
  document.getElementById('listing-drawer').classList.remove('open');
}

async function saveListing(e) {
  e.preventDefault();
  
  const payload = {
    listing_id: document.getElementById('form-listing-id').value || undefined,
    title: document.getElementById('form-title').value,
    price: Number(document.getElementById('form-price').value),
    property_type: document.getElementById('form-type').value,
    address: document.getElementById('form-address').value,
    parish: document.getElementById('form-parish').value,
    community: document.getElementById('form-community').value,
    bedrooms: Number(document.getElementById('form-beds').value) || null,
    bathrooms: Number(document.getElementById('form-baths').value) || null,
    sqft: Number(document.getElementById('form-sqft').value) || null,
    description: document.getElementById('form-description').value,
    features: document.getElementById('form-features').value,
    status: document.getElementById('form-status').value
  };
  
  try {
    const data = await Api.request('/api/realtor/listings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast(`Listing ${data.mode}!`, 'success');
    closeDrawer();
    loadListings();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleFeatured(listingId) {
  try {
    await Api.request(`/api/realtor/listings/${listingId}/toggle-featured`, { method: 'POST' });
    showToast('Featured status updated', 'success');
    loadListings();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function archiveListing(listingId) {
  if (!confirm('Archive this listing?')) return;
  
  try {
    await Api.request(`/api/realtor/listings/${listingId}/archive`, { method: 'POST' });
    showToast('Listing archived', 'success');
    loadListings();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== Pipeline ====================
async function loadPipeline() {
  await loadRequests();
  
  const columns = ['new', 'contacted', 'booked', 'closed'];
  
  content.innerHTML = `
    <div class="mb-8">
      <h1 class="font-clash font-bold text-2xl mb-2">Leads Pipeline</h1>
      <p class="text-[#a1a1aa]">Track and manage your viewing requests</p>
    </div>
    
    <div class="pipeline-container">
      ${columns.map(status => {
        const columnRequests = requests.filter(r => r.status === status);
        return `
          <div class="pipeline-column" data-status="${status}">
            <div class="pipeline-header">
              <h3>${status}</h3>
              <span class="pipeline-count">${columnRequests.length}</span>
            </div>
            <div class="pipeline-body">
              ${columnRequests.map(r => `
                <div class="pipeline-card" onclick="showRequestDetails('${r.request_id}')" data-testid="pipeline-card-${r.request_id}">
                  <div class="font-medium mb-1">${r.customer_name}</div>
                  <div class="text-[#666] text-sm mb-2">${r.customer_phone}</div>
                  <div class="text-[#a1a1aa] text-xs">${r.request_type} • ${formatTimeAgo(r.created_at)}</div>
                </div>
              `).join('')}
              ${columnRequests.length === 0 ? `
                <div class="text-center py-8 text-[#666] text-sm">No requests</div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ==================== Requests ====================
async function loadRequests() {
  try {
    const data = await Api.request('/api/realtor/requests');
    requests = data.requests;
    
    // Update badge
    const newCount = requests.filter(r => r.status === 'new').length;
    const badge = document.getElementById('requests-badge');
    if (newCount > 0) {
      badge.textContent = newCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (error) {
    console.error('Failed to load requests:', error);
  }
}

async function loadRequestsTab() {
  await loadRequests();
  
  content.innerHTML = `
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-clash font-bold text-2xl mb-2">Requests</h1>
        <p class="text-[#a1a1aa]">All viewing requests from your customers</p>
      </div>
    </div>
    
    ${requests.length ? `
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Property</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map(r => `
                <tr>
                  <td class="font-medium">${r.customer_name}</td>
                  <td>
                    <div>${r.customer_phone}</div>
                    <div class="text-[#666] text-sm">${r.customer_email || '—'}</div>
                  </td>
                  <td class="capitalize">${r.request_type.replace('_', ' ')}</td>
                  <td>${r.listing_id || 'General'}</td>
                  <td class="text-[#a1a1aa]">${formatTimeAgo(r.created_at)}</td>
                  <td><span class="status-badge ${r.status}">${r.status}</span></td>
                  <td>
                    <select onchange="updateRequestStatus('${r.request_id}', this.value)" class="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-sm" data-testid="status-select-${r.request_id}">
                      <option value="new" ${r.status === 'new' ? 'selected' : ''}>New</option>
                      <option value="contacted" ${r.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                      <option value="booked" ${r.status === 'booked' ? 'selected' : ''}>Booked</option>
                      <option value="closed" ${r.status === 'closed' ? 'selected' : ''}>Closed</option>
                      <option value="no_show" ${r.status === 'no_show' ? 'selected' : ''}>No Show</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ph ph-clipboard-text"></i></div>
        <h3 class="font-semibold mb-2">No requests yet</h3>
        <p class="text-[#a1a1aa]">Viewing requests from customers will appear here</p>
      </div>
    `}
  `;
}

async function updateRequestStatus(requestId, status) {
  try {
    await Api.request(`/api/realtor/requests/${requestId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    showToast('Status updated', 'success');
    loadRequests();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showRequestDetails(requestId) {
  const request = requests.find(r => r.request_id === requestId);
  if (!request) return;
  
  alert(`Request Details:\nCustomer: ${request.customer_name}\nPhone: ${request.customer_phone}\nType: ${request.request_type}\nNotes: ${request.notes || 'None'}`);
}

// ==================== Profile ====================
async function loadProfile() {
  content.innerHTML = `
    <div class="mb-8">
      <h1 class="font-clash font-bold text-2xl mb-2">Profile Settings</h1>
      <p class="text-[#a1a1aa]">Manage your account information</p>
    </div>
    
    <div class="max-w-2xl">
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6 mb-6">
        <h3 class="font-clash font-semibold text-lg mb-4">Account Information</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-[#666]">Agency ID</span>
            <p class="font-medium">${me.agency_id}</p>
          </div>
          <div>
            <span class="text-[#666]">Realtor ID</span>
            <p class="font-medium">${me.realtor_id}</p>
          </div>
          <div>
            <span class="text-[#666]">Email</span>
            <p class="font-medium">${me.profile_email || '—'}</p>
          </div>
          <div>
            <span class="text-[#666]">Plan</span>
            <p class="font-medium capitalize">${me.branding_tier}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6">
        <h3 class="font-clash font-semibold text-lg mb-4">Profile Details</h3>
        <form id="profile-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input type="text" id="profile-name" class="form-input" value="${me.display_name || ''}" data-testid="profile-name">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" id="profile-phone" class="form-input" value="${me.phone || ''}" data-testid="profile-phone">
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp</label>
            <input type="tel" id="profile-whatsapp" class="form-input" value="${me.whatsapp || ''}" placeholder="e.g., 1876XXXXXXX" data-testid="profile-whatsapp">
          </div>
          <button type="submit" class="action-btn primary" data-testid="save-profile-btn">
            <i class="ph ph-check"></i>
            Save Changes
          </button>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const data = await Api.request('/api/realtor/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: document.getElementById('profile-name').value,
          phone: document.getElementById('profile-phone').value,
          whatsapp: document.getElementById('profile-whatsapp').value
        })
      });
      
      me = data.profile;
      document.getElementById('user-name').textContent = me.display_name || me.realtor_id;
      showToast('Profile updated', 'success');
      
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

// ==================== Utilities ====================
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(price || 0);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="ph ${type === 'success' ? 'ph-check' : 'ph-x'}"></i>
    </div>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-exit 0.4s forwards';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', init);

// Global functions
window.openListingDrawer = openListingDrawer;
window.closeDrawer = closeDrawer;
window.toggleFeatured = toggleFeatured;
window.archiveListing = archiveListing;
window.deleteMedia = deleteMedia;
window.updateRequestStatus = updateRequestStatus;
window.showRequestDetails = showRequestDetails;
