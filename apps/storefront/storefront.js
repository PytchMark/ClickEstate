// ==================== State Management ====================
let listings = [];
let compareList = [];
let currentAgencyId = '';
let currentGalleryIndex = 0;
let currentGalleryImages = [];

// ==================== Initialize Lenis Smooth Scroll ====================
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
  smoothTouch: false
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Connect Lenis to GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ==================== Three.js Background ====================
function initThreeJS() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;
  
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Create floating particles
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 800;
  const posArray = new Float32Array(particlesCount * 3);
  
  for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 10;
  }
  
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.015,
    color: 0xff3b30,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  
  const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);
  
  camera.position.z = 3;
  
  // Animation
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  
  function animate() {
    requestAnimationFrame(animate);
    
    particlesMesh.rotation.x += 0.0003;
    particlesMesh.rotation.y += 0.0005;
    
    particlesMesh.rotation.x += mouseY * 0.0005;
    particlesMesh.rotation.y += mouseX * 0.0005;
    
    renderer.render(scene, camera);
  }
  animate();
  
  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ==================== GSAP Animations ====================
function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);
  
  // Hero animations
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' }});
  
  heroTl
    .to('.hero-tag', { opacity: 1, y: 0, duration: 0.8, delay: 0.3 })
    .to('.hero-title', { opacity: 1, y: 0, duration: 1 }, '-=0.5')
    .to('.hero-desc', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
    .to('.hero-search', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
    .to('.hero-badges', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
    .to('.scroll-indicator', { opacity: 1, duration: 0.8 }, '-=0.3');
  
  // Hero video parallax
  gsap.to('.hero-video', {
    yPercent: 30,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero-section',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });
  
  // Navbar scroll effect
  ScrollTrigger.create({
    start: 100,
    onUpdate: (self) => {
      const nav = document.querySelector('.nav-blur');
      if (self.direction === 1 && self.scroll() > 100) {
        nav.classList.add('scrolled');
      } else if (self.scroll() < 100) {
        nav.classList.remove('scrolled');
      }
    }
  });
  
  // Reveal animations for elements
  gsap.utils.toArray('.reveal-up').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none reverse'
      }
    });
  });
  
  // Stats counter animation
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.count);
    gsap.to(el, {
      innerText: target,
      duration: 2,
      ease: 'power2.out',
      snap: { innerText: 1 },
      scrollTrigger: {
        trigger: el,
        start: 'top 80%',
        toggleActions: 'play none none reverse'
      }
    });
  });
}

// ==================== Toast Notifications ====================
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

// ==================== Format Helpers ====================
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(price || 0);
}

function parseImages(raw) {
  try {
    return Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

// ==================== Property Card Rendering ====================
function renderPropertyCard(listing, index) {
  const images = parseImages(listing.image_urls);
  const imageUrl = images[0] || 'https://images.unsplash.com/photo-1706808849827-7366c098b317?w=600';
  const isInCompare = compareList.some(l => l.listing_id === listing.listing_id);
  const isNew = new Date(listing.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasVideo = listing.video_url;
  
  return `
    <article class="property-card" data-listing-id="${listing.listing_id}" data-testid="property-card-${index}">
      <div class="property-card-image">
        <img src="${imageUrl}" alt="${listing.title || 'Property'}" loading="lazy">
        ${listing.featured ? '<span class="property-tag">Featured</span>' : isNew ? '<span class="property-tag new">New</span>' : ''}
        <button class="property-compare-btn ${isInCompare ? 'added' : ''}" onclick="toggleCompare('${listing.listing_id}')" data-testid="compare-btn-${index}">
          <i class="ph ${isInCompare ? 'ph-check' : 'ph-scales'}"></i>
        </button>
        ${hasVideo ? '<div class="virtual-tour-badge"><i class="ph ph-video-camera"></i> Video Tour</div>' : ''}
      </div>
      <div class="property-card-content">
        <div class="property-price">${formatPrice(listing.price)}</div>
        <h3 class="property-title">${listing.title || 'Beautiful Property'}</h3>
        <p class="property-location">
          <i class="ph ph-map-pin"></i>
          ${listing.community || ''} ${listing.parish || ''}
        </p>
        <div class="property-stats">
          <span class="property-stat"><i class="ph ph-bed"></i> ${listing.bedrooms || 0} Beds</span>
          <span class="property-stat"><i class="ph ph-bathtub"></i> ${listing.bathrooms || 0} Baths</span>
          <span class="property-stat"><i class="ph ph-ruler"></i> ${listing.sqft ? listing.sqft.toLocaleString() : '—'} sqft</span>
        </div>
        <button class="w-full mt-4 bg-transparent border border-[#262626] text-white py-3 rounded-lg font-medium uppercase tracking-wider text-sm hover:bg-primary hover:border-primary transition-all duration-300" onclick="openListingModal('${listing.listing_id}')" data-testid="view-listing-${index}">
          View Details
        </button>
      </div>
    </article>
  `;
}

// ==================== Load Listings ====================
async function loadListings() {
  const agencyInput = document.getElementById('agency-input');
  const agencyIds = agencyInput.value.trim();
  
  if (!agencyIds) {
    showToast('Please enter an Agency ID', 'error');
    return;
  }
  
  currentAgencyId = agencyIds.split(',')[0].trim();
  
  // Show loading state
  document.getElementById('listings-loading').classList.remove('hidden');
  document.getElementById('listings-empty').classList.add('hidden');
  document.getElementById('listings-grid').innerHTML = '';
  
  try {
    // Load agency info
    const agencyRes = await Api.request(`/api/public/agency/${currentAgencyId}`);
    if (agencyRes.ok && agencyRes.agency) {
      const agency = agencyRes.agency;
      document.getElementById('agency-name').textContent = agency.display_name || agency.agency_id;
      
      const logoEl = document.getElementById('agency-logo');
      if (agency.logo_url) {
        logoEl.innerHTML = `<img src="${agency.logo_url}" alt="Agency Logo" class="w-full h-full object-cover">`;
      }
      
      const whatsappBtn = document.getElementById('agency-whatsapp');
      if (agency.whatsapp) {
        whatsappBtn.href = `https://wa.me/${agency.whatsapp}`;
        whatsappBtn.classList.remove('hidden');
      } else {
        whatsappBtn.classList.add('hidden');
      }
      
      document.getElementById('agency-header').classList.remove('hidden');
    }
    
    // Load listings
    const listingsRes = await Api.request(`/api/public/listings?agencyIds=${encodeURIComponent(agencyIds)}`);
    listings = listingsRes.listings || [];
    
    // Update parishes filter
    const parishes = [...new Set(listings.map(l => l.parish).filter(Boolean))];
    const parishSelect = document.getElementById('filter-parish');
    parishSelect.innerHTML = '<option value="">All Parishes</option>' + 
      parishes.map(p => `<option value="${p}">${p}</option>`).join('');
    
    // Show filters
    document.getElementById('filters-section').classList.remove('hidden');
    
    renderListings();
    
  } catch (error) {
    showToast(error.message || 'Failed to load listings', 'error');
    document.getElementById('listings-empty').classList.remove('hidden');
  } finally {
    document.getElementById('listings-loading').classList.add('hidden');
  }
}

// ==================== Render Listings with Filters ====================
function renderListings() {
  const parish = document.getElementById('filter-parish').value;
  const propertyType = document.getElementById('filter-type').value;
  const minBeds = parseInt(document.getElementById('filter-beds').value) || 0;
  const maxPrice = parseInt(document.getElementById('filter-max-price').value) || Infinity;
  
  const filtered = listings.filter(l => {
    if (parish && l.parish !== parish) return false;
    if (propertyType && l.property_type !== propertyType) return false;
    if ((l.bedrooms || 0) < minBeds) return false;
    if ((l.price || 0) > maxPrice) return false;
    return true;
  });
  
  const grid = document.getElementById('listings-grid');
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16">
        <i class="ph ph-house-line text-5xl text-[#333] mb-4"></i>
        <p class="text-[#a1a1aa]">No listings match your filters</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map((l, i) => renderPropertyCard(l, i)).join('');
  
  // Animate cards
  gsap.from('.property-card', {
    opacity: 0,
    y: 50,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power3.out'
  });
}

// ==================== Listing Modal ====================
async function openListingModal(listingId) {
  try {
    const res = await Api.request(`/api/public/listing/${listingId}`);
    const listing = res.listing;
    const images = parseImages(listing.image_urls);
    currentGalleryImages = images.length ? images : ['https://images.unsplash.com/photo-1706808849827-7366c098b317?w=1200'];
    currentGalleryIndex = 0;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
      <div class="modal-gallery">
        <img id="gallery-main-image" src="${currentGalleryImages[0]}" alt="${listing.title}" class="modal-gallery-main">
        ${currentGalleryImages.length > 1 ? `
          <button class="modal-gallery-arrow prev" onclick="prevGalleryImage()"><i class="ph ph-caret-left text-xl"></i></button>
          <button class="modal-gallery-arrow next" onclick="nextGalleryImage()"><i class="ph ph-caret-right text-xl"></i></button>
          <div class="modal-gallery-nav">
            ${currentGalleryImages.map((_, i) => `<div class="modal-gallery-dot ${i === 0 ? 'active' : ''}" onclick="goToGalleryImage(${i})"></div>`).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="md:col-span-2">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h2 class="font-clash font-bold text-3xl mb-2">${listing.title || 'Beautiful Property'}</h2>
              <p class="text-[#a1a1aa] flex items-center gap-2">
                <i class="ph ph-map-pin"></i>
                ${listing.address || ''} ${listing.community || ''} ${listing.parish || ''}
              </p>
            </div>
            <div class="text-right">
              <p class="font-clash font-bold text-3xl text-primary">${formatPrice(listing.price)}</p>
              <p class="text-[#a1a1aa] text-sm">ID: ${listing.listing_id}</p>
            </div>
          </div>
          
          <div class="grid grid-cols-4 gap-4 mb-6 p-4 bg-[#121212] rounded-lg border border-[#262626]">
            <div class="text-center">
              <p class="font-clash font-bold text-xl">${listing.bedrooms || 0}</p>
              <p class="text-[#a1a1aa] text-sm">Beds</p>
            </div>
            <div class="text-center">
              <p class="font-clash font-bold text-xl">${listing.bathrooms || 0}</p>
              <p class="text-[#a1a1aa] text-sm">Baths</p>
            </div>
            <div class="text-center">
              <p class="font-clash font-bold text-xl">${listing.sqft ? listing.sqft.toLocaleString() : '—'}</p>
              <p class="text-[#a1a1aa] text-sm">Sq Ft</p>
            </div>
            <div class="text-center">
              <p class="font-clash font-bold text-xl">${listing.lot_size || '—'}</p>
              <p class="text-[#a1a1aa] text-sm">Lot</p>
            </div>
          </div>
          
          <div class="mb-6">
            <h3 class="font-clash font-semibold text-lg mb-3">Description</h3>
            <p class="text-[#a1a1aa] leading-relaxed">${listing.description || 'No description provided.'}</p>
          </div>
          
          ${listing.features ? `
            <div class="mb-6">
              <h3 class="font-clash font-semibold text-lg mb-3">Features</h3>
              <div class="flex flex-wrap gap-2">
                ${listing.features.split(',').map(f => `<span class="px-3 py-1 bg-[#1a1a1a] border border-[#262626] rounded-full text-sm">${f.trim()}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          ${listing.video_url ? `
            <div class="mb-6">
              <h3 class="font-clash font-semibold text-lg mb-3">Video Tour</h3>
              <video controls class="w-full rounded-lg" src="${listing.video_url}"></video>
            </div>
          ` : ''}
        </div>
        
        <div>
          <div class="sticky top-24 space-y-4">
            ${listing.realtor ? `
              <div class="p-4 bg-[#121212] rounded-lg border border-[#262626] mb-4">
                <p class="text-[#a1a1aa] text-sm mb-1">Listed by</p>
                <p class="font-semibold">${listing.realtor.display_name || 'Agent'}</p>
              </div>
            ` : ''}
            
            <button onclick="openRequestModal('${listing.listing_id}', '${listing.agency_id}', '${listing.realtor_id}')" class="w-full bg-primary text-white py-4 rounded-lg font-medium uppercase tracking-wider hover:bg-[#d63026] transition-colors flex items-center justify-center gap-2" data-testid="book-viewing-btn">
              <i class="ph ph-calendar-check"></i>
              Book Viewing
            </button>
            
            ${listing.realtor?.whatsapp ? `
              <a href="https://wa.me/${listing.realtor.whatsapp}?text=Hi, I'm interested in property ${listing.listing_id}" target="_blank" class="w-full bg-[#25D366] text-white py-4 rounded-lg font-medium uppercase tracking-wider hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2">
                <i class="ph ph-whatsapp-logo"></i>
                WhatsApp Agent
              </a>
            ` : ''}
            
            <button onclick="openRequestModal('${listing.listing_id}', '${listing.agency_id}', '${listing.realtor_id}', 'live_video')" class="w-full bg-transparent border border-[#262626] text-white py-4 rounded-lg font-medium uppercase tracking-wider hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2">
              <i class="ph ph-video-camera"></i>
              Request Video Tour
            </button>
            
            <button onclick="toggleCompare('${listing.listing_id}')" class="w-full bg-transparent border border-[#262626] text-white py-4 rounded-lg font-medium uppercase tracking-wider hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2" data-testid="add-compare-modal-btn">
              <i class="ph ph-scales"></i>
              Add to Compare
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('listing-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    showToast(error.message || 'Failed to load listing details', 'error');
  }
}

function closeListingModal() {
  document.getElementById('listing-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// Gallery navigation
function nextGalleryImage() {
  currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
  updateGalleryImage();
}

function prevGalleryImage() {
  currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
  updateGalleryImage();
}

function goToGalleryImage(index) {
  currentGalleryIndex = index;
  updateGalleryImage();
}

function updateGalleryImage() {
  const img = document.getElementById('gallery-main-image');
  if (img) {
    gsap.to(img, { opacity: 0, duration: 0.2, onComplete: () => {
      img.src = currentGalleryImages[currentGalleryIndex];
      gsap.to(img, { opacity: 1, duration: 0.3 });
    }});
  }
  
  document.querySelectorAll('.modal-gallery-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentGalleryIndex);
  });
}

// ==================== Request Modal ====================
function openRequestModal(listingId, agencyId, realtorId, type = 'walk_in') {
  document.getElementById('req-listing-id').value = listingId;
  document.getElementById('req-agency-id').value = agencyId;
  document.getElementById('req-realtor-id').value = realtorId;
  document.getElementById('req-type').value = type;
  document.getElementById('request-modal').classList.remove('hidden');
}

function closeRequestModal() {
  document.getElementById('request-modal').classList.add('hidden');
  document.getElementById('request-form').reset();
}

async function submitRequest(e) {
  e.preventDefault();
  
  const payload = {
    listing_id: document.getElementById('req-listing-id').value,
    realtor_id: document.getElementById('req-realtor-id').value,
    customer_name: document.getElementById('req-name').value,
    customer_phone: document.getElementById('req-phone').value,
    customer_email: document.getElementById('req-email').value,
    request_type: document.getElementById('req-type').value,
    preferred_date: document.getElementById('req-date').value,
    preferred_time: document.getElementById('req-time').value,
    notes: document.getElementById('req-notes').value
  };
  
  const agencyId = document.getElementById('req-agency-id').value;
  
  try {
    await Api.request(`/api/public/agency/${agencyId}/requests`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Request submitted! An agent will contact you soon.', 'success');
    closeRequestModal();
    closeListingModal();
    
  } catch (error) {
    showToast(error.message || 'Failed to submit request', 'error');
  }
}

// ==================== Compare Functionality ====================
function toggleCompare(listingId) {
  const listing = listings.find(l => l.listing_id === listingId);
  if (!listing) return;
  
  const existingIndex = compareList.findIndex(l => l.listing_id === listingId);
  
  if (existingIndex >= 0) {
    compareList.splice(existingIndex, 1);
    showToast('Removed from comparison', 'success');
  } else {
    if (compareList.length >= 4) {
      showToast('Maximum 4 properties can be compared', 'error');
      return;
    }
    compareList.push(listing);
    showToast('Added to comparison', 'success');
  }
  
  updateCompareUI();
  renderListings(); // Re-render to update compare buttons
}

function updateCompareUI() {
  const slots = document.querySelectorAll('.compare-slot');
  
  slots.forEach((slot, index) => {
    const listing = compareList[index];
    
    if (listing) {
      const images = parseImages(listing.image_urls);
      const imageUrl = images[0] || 'https://images.unsplash.com/photo-1706808849827-7366c098b317?w=400';
      
      slot.innerHTML = `
        <div class="compare-slot-filled">
          <img src="${imageUrl}" alt="${listing.title}">
          <button class="remove-btn" onclick="removeFromCompare(${index})">
            <i class="ph ph-x text-sm"></i>
          </button>
          <div class="slot-info">
            <p class="font-clash font-semibold text-sm truncate">${listing.title || 'Property'}</p>
            <p class="text-primary font-semibold">${formatPrice(listing.price)}</p>
          </div>
        </div>
      `;
    } else {
      slot.innerHTML = `
        <div class="h-48 bg-[#121212] border-2 border-dashed border-[#262626] rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
          <div class="text-center">
            <i class="ph ph-plus text-3xl text-[#444] mb-2"></i>
            <p class="text-[#666] text-sm">Add Property</p>
          </div>
        </div>
      `;
    }
  });
  
  updateCompareTable();
}

function removeFromCompare(index) {
  compareList.splice(index, 1);
  updateCompareUI();
  renderListings();
}

function updateCompareTable() {
  const table = document.getElementById('compare-table');
  const tbody = document.getElementById('compare-tbody');
  
  if (compareList.length < 2) {
    table.classList.add('hidden');
    return;
  }
  
  table.classList.remove('hidden');
  
  // Update headers
  compareList.forEach((listing, i) => {
    document.getElementById(`compare-head-${i}`).textContent = listing.title || `Property ${i + 1}`;
  });
  
  // Hide unused headers
  for (let i = compareList.length; i < 4; i++) {
    document.getElementById(`compare-head-${i}`).textContent = '';
  }
  
  // Define comparison rows
  const rows = [
    { label: 'Price', key: 'price', format: (v) => formatPrice(v) },
    { label: 'Bedrooms', key: 'bedrooms' },
    { label: 'Bathrooms', key: 'bathrooms' },
    { label: 'Sq Ft', key: 'sqft', format: (v) => v ? v.toLocaleString() : '—' },
    { label: 'Lot Size', key: 'lot_size' },
    { label: 'Property Type', key: 'property_type' },
    { label: 'Parish', key: 'parish' },
    { label: 'Community', key: 'community' }
  ];
  
  tbody.innerHTML = rows.map(row => `
    <tr class="border-b border-[#262626]">
      <td class="py-4 px-4 text-[#a1a1aa]">${row.label}</td>
      ${Array(4).fill(0).map((_, i) => {
        const listing = compareList[i];
        let value = listing ? (listing[row.key] || '—') : '';
        if (row.format && listing) value = row.format(listing[row.key]);
        return `<td class="py-4 px-4 ${i < compareList.length ? '' : 'opacity-0'}">${value}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

// ==================== Event Listeners ====================
document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  initAnimations();
  
  // Load listings button
  document.getElementById('load-listings-btn').addEventListener('click', loadListings);
  
  // Enter key to search
  document.getElementById('agency-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadListings();
  });
  
  // Filter listeners
  ['filter-parish', 'filter-type', 'filter-beds', 'filter-max-price'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderListings);
    document.getElementById(id).addEventListener('input', renderListings);
  });
  
  // Clear filters
  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-parish').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-beds').value = '';
    document.getElementById('filter-max-price').value = '';
    renderListings();
  });
  
  // Modal close handlers
  document.getElementById('modal-close').addEventListener('click', closeListingModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeListingModal);
  
  document.getElementById('request-close').addEventListener('click', closeRequestModal);
  document.querySelector('.request-backdrop').addEventListener('click', closeRequestModal);
  
  // Request form submit
  document.getElementById('request-form').addEventListener('submit', submitRequest);
  
  // Mobile menu
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.remove('hidden');
    document.getElementById('mobile-menu').classList.add('flex');
  });
  
  document.getElementById('mobile-menu-close').addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.add('hidden');
    document.getElementById('mobile-menu').classList.remove('flex');
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeListingModal();
      closeRequestModal();
    }
    if (e.key === 'ArrowRight' && !document.getElementById('listing-modal').classList.contains('hidden')) {
      nextGalleryImage();
    }
    if (e.key === 'ArrowLeft' && !document.getElementById('listing-modal').classList.contains('hidden')) {
      prevGalleryImage();
    }
  });
});

// Make functions globally available
window.openListingModal = openListingModal;
window.toggleCompare = toggleCompare;
window.removeFromCompare = removeFromCompare;
window.openRequestModal = openRequestModal;
window.nextGalleryImage = nextGalleryImage;
window.prevGalleryImage = prevGalleryImage;
window.goToGalleryImage = goToGalleryImage;
