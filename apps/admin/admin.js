// ==================== State Management ====================
let analytics = null;
let agencies = [];
let listings = [];
let requests = [];
let socket = null;
let charts = {};

// ==================== DOM Elements ====================
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const content = document.getElementById('content');

// ==================== Initialize ====================
async function init() {
  // Check for existing token
  if (Api.token) {
    try {
      const data = await Api.request('/api/admin/summary');
      enterDashboard();
    } catch {
      Api.clearToken();
    }
  }
  
  // Login form handler
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Navigation handlers
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      loadTab(item.dataset.tab);
    });
  });
  
  // Logout handler
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Create form handler
  document.getElementById('create-form').addEventListener('submit', createAgency);
  
  // Reset form handler
  document.getElementById('reset-form').addEventListener('submit', resetPassword);
  
  // Modal backdrop close
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', () => {
      closeCreateModal();
      closeResetModal();
    });
  });
}

// ==================== Authentication ====================
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('admin-user').value;
  const password = document.getElementById('admin-pass').value;
  
  try {
    const data = await Api.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    Api.setToken(data.token);
    enterDashboard();
    
  } catch (error) {
    showToast(error.message || 'Invalid credentials', 'error');
  }
}

function enterDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  
  // Initialize WebSocket
  initWebSocket();
  
  // Load initial data
  loadTab('overview');
}

function logout() {
  Api.clearToken();
  if (socket) socket.disconnect();
  location.reload();
}

// ==================== WebSocket ====================
function initWebSocket() {
  socket = io({ auth: { token: Api.token } });
  
  socket.on('connect', () => {
    console.log('[WS] Admin connected');
  });
  
  socket.on('admin_request', (data) => {
    showToast(`New request: ${data.request.customer_name}`, 'success');
    document.getElementById('notification-dot').classList.remove('hidden');
  });
  
  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });
}

// ==================== Tab Loading ====================
async function loadTab(tab) {
  // Update active nav
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });
  
  // Animation
  gsap.to(content, {
    opacity: 0,
    duration: 0.15,
    onComplete: async () => {
      switch(tab) {
        case 'overview':
          await loadOverview();
          break;
        case 'agencies':
          await loadAgencies();
          break;
        case 'listings':
          await loadListings();
          break;
        case 'requests':
          await loadRequests();
          break;
      }
      
      gsap.to(content, { opacity: 1, duration: 0.3 });
    }
  });
}

// ==================== Overview ====================
async function loadOverview() {
  try {
    const [summaryRes, analyticsRes] = await Promise.all([
      Api.request('/api/admin/summary'),
      Api.request('/api/admin/analytics')
    ]);
    
    const summary = summaryRes.summary;
    analytics = analyticsRes.analytics;
    
    content.innerHTML = `
      <div class="mb-8">
        <h1 class="font-clash font-bold text-2xl mb-2">Platform Overview</h1>
        <p class="text-[#a1a1aa]">Monitor your real estate platform performance</p>
      </div>
      
      <!-- KPI Cards -->
      <div class="kpi-grid mb-8">
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-buildings"></i></div>
          <div class="kpi-value">${summary.agencies}</div>
          <div class="kpi-label">Agencies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-users"></i></div>
          <div class="kpi-value">${summary.realtors}</div>
          <div class="kpi-label">Realtors</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-house"></i></div>
          <div class="kpi-value">${summary.listings}</div>
          <div class="kpi-label">Listings</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-clipboard-text"></i></div>
          <div class="kpi-value">${summary.requests}</div>
          <div class="kpi-label">Requests</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i class="ph ph-user-check"></i></div>
          <div class="kpi-value">${summary.activeProfiles}</div>
          <div class="kpi-label">Active Profiles</div>
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
            <h3 class="chart-title">Request Status Distribution</h3>
          </div>
          <canvas id="status-chart" height="200"></canvas>
        </div>
      </div>
      
      <!-- Additional Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Listings by Status</h3>
          </div>
          <div class="grid grid-cols-2 gap-4 mt-4">
            ${Object.entries(analytics?.listingsByStatus || {}).map(([status, count]) => `
              <div class="flex items-center justify-between p-3 bg-[#121212] rounded-lg">
                <span class="capitalize">${status}</span>
                <span class="font-clash font-bold">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Profiles by Tier</h3>
          </div>
          <div class="grid grid-cols-2 gap-4 mt-4">
            ${Object.entries(analytics?.profiles?.byTier || {}).map(([tier, count]) => `
              <div class="flex items-center justify-between p-3 bg-[#121212] rounded-lg">
                <span class="tier-badge ${tier}">${tier}</span>
                <span class="font-clash font-bold">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
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

// ==================== Agencies ====================
async function loadAgencies() {
  try {
    const data = await Api.request('/api/admin/agencies?page=1&pageSize=100');
    agencies = data.agencies;
    
    content.innerHTML = `
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-clash font-bold text-2xl mb-2">Agencies & Realtors</h1>
          <p class="text-[#a1a1aa]">Manage platform users</p>
        </div>
        <div class="flex gap-3">
          <button onclick="openResetModal()" class="btn-secondary" data-testid="reset-password-btn">
            <i class="ph ph-key"></i>
            Reset Password
          </button>
          <button onclick="openCreateModal()" class="btn-primary" data-testid="create-agency-btn">
            <i class="ph ph-plus"></i>
            Create Agency
          </button>
        </div>
      </div>
      
      <div class="search-bar">
        <div class="search-wrapper">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" id="agency-search" class="search-input" placeholder="Search agencies..." data-testid="agency-search">
        </div>
        <select id="status-filter" class="filter-select" data-testid="status-filter">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <button onclick="exportAgenciesCSV()" class="btn-secondary" data-testid="export-csv-btn">
          <i class="ph ph-download-simple"></i>
          Export CSV
        </button>
      </div>
      
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table" id="agencies-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Members</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${agencies.map(a => `
                <tr>
                  <td>
                    <div class="font-medium">${a.agency_id}</div>
                  </td>
                  <td>
                    ${a.members.map(m => `
                      <div class="text-sm mb-1">
                        <span class="font-medium">${m.display_name || m.realtor_id}</span>
                        <span class="text-[#666] ml-1">${m.profile_email || ''}</span>
                      </div>
                    `).join('')}
                  </td>
                  <td>
                    <span class="tier-badge ${a.members[0]?.branding_tier || 'starter'}">${a.members[0]?.branding_tier || 'starter'}</span>
                  </td>
                  <td>
                    <span class="status-badge ${a.members[0]?.status || 'active'}">${a.members[0]?.status || 'active'}</span>
                  </td>
                  <td class="text-[#a1a1aa]">${formatDate(a.members[0]?.created_at)}</td>
                  <td>
                    <button onclick="toggleAgencyStatus('${a.members[0]?.id || ''}', '${a.members[0]?.status}')" class="btn-secondary btn-sm" data-testid="toggle-status-${a.agency_id}">
                      ${a.members[0]?.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Search handler
    document.getElementById('agency-search').addEventListener('input', filterAgencies);
    document.getElementById('status-filter').addEventListener('change', filterAgencies);
    
  } catch (error) {
    content.innerHTML = `<div class="text-center py-20 text-red-500">${error.message}</div>`;
  }
}

function filterAgencies() {
  const search = document.getElementById('agency-search').value.toLowerCase();
  const status = document.getElementById('status-filter').value;
  
  const rows = document.querySelectorAll('#agencies-table tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const rowStatus = row.querySelector('.status-badge')?.textContent.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesStatus = !status || rowStatus === status;
    row.style.display = matchesSearch && matchesStatus ? '' : 'none';
  });
}

async function toggleAgencyStatus(profileId, currentStatus) {
  if (!profileId) return;
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  
  try {
    await Api.request(`/api/admin/agencies/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Status updated to ${newStatus}`, 'success');
    loadAgencies();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function exportAgenciesCSV() {
  const lines = ['Agency ID,Realtor ID,Display Name,Email,Status,Tier,Created'];
  agencies.forEach(a => {
    a.members.forEach(m => {
      lines.push([
        a.agency_id,
        m.realtor_id,
        m.display_name || '',
        m.profile_email || '',
        m.status,
        m.branding_tier,
        formatDate(m.created_at)
      ].join(','));
    });
  });
  
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clickestate-agencies.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== Listings ====================
async function loadListings() {
  try {
    const data = await Api.request('/api/admin/listings?limit=100');
    listings = data.listings;
    
    content.innerHTML = `
      <div class="mb-8">
        <h1 class="font-clash font-bold text-2xl mb-2">All Listings</h1>
        <p class="text-[#a1a1aa]">View and manage all platform listings</p>
      </div>
      
      <div class="search-bar">
        <div class="search-wrapper">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" id="listing-search" class="search-input" placeholder="Search listings..." data-testid="listing-search">
        </div>
        <select id="listing-status-filter" class="filter-select" data-testid="listing-status-filter">
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="under_offer">Under Offer</option>
          <option value="sold">Sold</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table" id="listings-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Agency</th>
                <th>Price</th>
                <th>Details</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${listings.map(l => `
                <tr>
                  <td>
                    <div class="font-medium">${l.title || 'Untitled'}</div>
                    <div class="text-[#666] text-sm">${l.listing_id}</div>
                  </td>
                  <td>
                    <div>${l.agency_id}</div>
                    <div class="text-[#666] text-sm">${l.realtor_id}</div>
                  </td>
                  <td class="font-clash font-semibold">${formatPrice(l.price)}</td>
                  <td class="text-[#a1a1aa]">
                    ${l.bedrooms || 0} bd • ${l.bathrooms || 0} ba
                  </td>
                  <td><span class="status-badge ${l.status}">${l.status}</span></td>
                  <td class="text-[#a1a1aa]">${formatDate(l.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Search handler
    document.getElementById('listing-search').addEventListener('input', filterListings);
    document.getElementById('listing-status-filter').addEventListener('change', filterListings);
    
  } catch (error) {
    content.innerHTML = `<div class="text-center py-20 text-red-500">${error.message}</div>`;
  }
}

function filterListings() {
  const search = document.getElementById('listing-search').value.toLowerCase();
  const status = document.getElementById('listing-status-filter').value;
  
  const rows = document.querySelectorAll('#listings-table tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const rowStatus = row.querySelector('.status-badge')?.textContent.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesStatus = !status || rowStatus === status;
    row.style.display = matchesSearch && matchesStatus ? '' : 'none';
  });
}

// ==================== Requests ====================
async function loadRequests() {
  try {
    const data = await Api.request('/api/admin/requests?limit=100');
    requests = data.requests;
    
    content.innerHTML = `
      <div class="mb-8">
        <h1 class="font-clash font-bold text-2xl mb-2">All Requests</h1>
        <p class="text-[#a1a1aa]">View all viewing requests across the platform</p>
      </div>
      
      <div class="search-bar">
        <div class="search-wrapper">
          <i class="ph ph-magnifying-glass"></i>
          <input type="text" id="request-search" class="search-input" placeholder="Search requests..." data-testid="request-search">
        </div>
        <select id="request-status-filter" class="filter-select" data-testid="request-status-filter">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
          <option value="closed">Closed</option>
          <option value="no_show">No Show</option>
        </select>
      </div>
      
      <div class="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table" id="requests-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Agency</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
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
                  <td>
                    <div>${r.agency_id}</div>
                    <div class="text-[#666] text-sm">${r.realtor_id}</div>
                  </td>
                  <td class="capitalize">${r.request_type.replace('_', ' ')}</td>
                  <td><span class="status-badge ${r.status}">${r.status}</span></td>
                  <td class="text-[#a1a1aa]">${formatDate(r.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Search handler
    document.getElementById('request-search').addEventListener('input', filterRequests);
    document.getElementById('request-status-filter').addEventListener('change', filterRequests);
    
  } catch (error) {
    content.innerHTML = `<div class="text-center py-20 text-red-500">${error.message}</div>`;
  }
}

function filterRequests() {
  const search = document.getElementById('request-search').value.toLowerCase();
  const status = document.getElementById('request-status-filter').value;
  
  const rows = document.querySelectorAll('#requests-table tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const rowStatus = row.querySelector('.status-badge')?.textContent.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesStatus = !status || rowStatus === status;
    row.style.display = matchesSearch && matchesStatus ? '' : 'none';
  });
}

// ==================== Modal Functions ====================
function openCreateModal() {
  document.getElementById('create-modal').classList.remove('hidden');
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.add('hidden');
  document.getElementById('create-form').reset();
}

function openResetModal() {
  document.getElementById('reset-modal').classList.remove('hidden');
}

function closeResetModal() {
  document.getElementById('reset-modal').classList.add('hidden');
  document.getElementById('reset-form').reset();
}

async function createAgency(e) {
  e.preventDefault();
  
  const payload = {
    agency_id: document.getElementById('c-agency-id').value,
    realtor_id: document.getElementById('c-realtor-id').value,
    display_name: document.getElementById('c-name').value,
    profile_email: document.getElementById('c-email').value,
    password: document.getElementById('c-password').value,
    phone: document.getElementById('c-phone').value,
    whatsapp: document.getElementById('c-whatsapp').value,
    branding_tier: document.getElementById('c-tier').value,
    role: 'agency_admin'
  };
  
  try {
    await Api.request('/api/admin/agencies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Agency created successfully', 'success');
    closeCreateModal();
    loadAgencies();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function resetPassword(e) {
  e.preventDefault();
  
  const payload = {
    agency_id: document.getElementById('r-agency-id').value,
    realtor_id: document.getElementById('r-realtor-id').value,
    password: document.getElementById('r-password').value
  };
  
  try {
    await Api.request('/api/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Password reset successfully', 'success');
    closeResetModal();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== Utilities ====================
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(price || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
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
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;
window.toggleAgencyStatus = toggleAgencyStatus;
window.exportAgenciesCSV = exportAgenciesCSV;
