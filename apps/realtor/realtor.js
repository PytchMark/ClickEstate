const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const content = document.getElementById('content');
let me = null;

async function initAuthCheck(){
  if (!Api.token) return;
  try { const data = await Api.request('/api/realtor/me'); me = data.profile; enterApp(); }
  catch { Api.clearToken(); }
}

function enterApp(){ UI.hide(loginView); UI.show(appView); loadTab('dashboard'); }

document.getElementById('loginBtn').onclick = async () => {
  try {
    const data = await Api.request('/api/realtor/login', { method: 'POST', body: JSON.stringify({ agencyIdOrEmailOrRealtorId: user.value, password: pass.value }) });
    Api.setToken(data.token); me = data.profile; enterApp();
  } catch(e){ UI.toast(e.message); }
};

async function loadTab(tab){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.tab===tab));
  if (tab === 'dashboard') {
    const data = await Api.request('/api/realtor/summary');
    content.innerHTML = `<h2>Welcome back, ${me.display_name || me.realtor_id}</h2><div class='grid kpis'>${Object.entries(data.kpis).map(([k,v])=>`<div class='card'><div class='muted'>${k}</div><h3>${v}</h3></div>`).join('')}</div>`;
  }
  if (tab === 'listings') {
    const data = await Api.request('/api/realtor/listings');
    content.innerHTML = `<div style='display:flex;justify-content:space-between'><h2>Listings Manager</h2><button class='btn btn-primary' id='newListing'>+ New Listing</button></div>
      <table class='table'><tr><th>ID</th><th>Title</th><th>Status</th><th>Actions</th></tr>${data.listings.map(l=>`<tr><td>${l.listing_id}</td><td>${l.title||''}</td><td>${l.status}</td><td><button class='btn' onclick='archiveListing("${l.listing_id}")'>Archive</button></td></tr>`).join('')}</table>
      <div id='drawer' class='drawer'><h3>Listing editor</h3><input id='ltitle' class='input' placeholder='Title'><input id='lprice' class='input' placeholder='Price'><button class='btn btn-primary' id='saveListing'>Save</button><input type='file' id='mediaFiles' multiple><button class='btn' id='uploadMedia'>Upload Media</button></div>`;
    document.getElementById('newListing').onclick = () => document.getElementById('drawer').classList.add('open');
    document.getElementById('saveListing').onclick = async () => {
      await Api.request('/api/realtor/listings', { method: 'POST', body: JSON.stringify({ title: ltitle.value, price: Number(lprice.value||0), status:'available' })});
      UI.toast('Saved'); loadTab('listings');
    };
    document.getElementById('uploadMedia').onclick = async () => {
      const id = prompt('Listing ID for media upload');
      const fd = new FormData(); fd.append('listingId', id);
      [...document.getElementById('mediaFiles').files].forEach(f => fd.append('media', f));
      const res = await fetch('/api/media/upload', { method:'POST', headers: { Authorization: `Bearer ${Api.token}` }, body: fd });
      const j = await res.json(); if(!res.ok||!j.ok) throw new Error(j.error); UI.toast('Media uploaded');
    };
  }
  if (tab === 'pipeline' || tab === 'requests') {
    const data = await Api.request('/api/realtor/requests');
    if (tab === 'requests') {
      content.innerHTML = `<h2>Requests</h2><table class='table'><tr><th>ID</th><th>Customer</th><th>Status</th><th>Action</th></tr>${data.requests.map(r=>`<tr><td>${r.request_id}</td><td>${r.customer_name}</td><td>${r.status}</td><td><button class='btn' onclick='moveRequest("${r.request_id}")'>Advance</button></td></tr>`).join('')}</table>`;
    } else {
      const cols = ['new','contacted','booked','closed'];
      content.innerHTML = `<h2>Leads Pipeline</h2><div class='grid pipeline'>${cols.map(c=>`<div class='card status-col'><h4>${c}</h4>${data.requests.filter(r=>r.status===c).map(r=>`<p>${r.customer_name} <button class='btn' onclick='moveRequest("${r.request_id}")'>Move</button></p>`).join('')}</div>`).join('')}</div>`;
    }
  }
  if (tab === 'profile') content.innerHTML = `<h2>Profile</h2><div class='card'><p>${me.display_name}</p><p>${me.profile_email}</p><p>Tier: ${me.branding_tier}</p></div>`;
  if (tab === 'settings') content.innerHTML = `<h2>Settings</h2><button class='btn' id='logout'>Logout</button>`;
  const logout = document.getElementById('logout'); if (logout) logout.onclick = () => { Api.clearToken(); location.reload(); };
}

window.archiveListing = async (id) => { await Api.request(`/api/realtor/listings/${id}/archive`, { method: 'POST' }); UI.toast('Archived'); loadTab('listings'); };
window.moveRequest = async (id) => { const next = prompt('New status: new/contacted/booked/closed/no_show', 'contacted'); await Api.request(`/api/realtor/requests/${id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) }); UI.toast('Updated'); loadTab('requests'); };

document.querySelectorAll('.nav-item').forEach(n => n.onclick = () => loadTab(n.dataset.tab));
initAuthCheck();
