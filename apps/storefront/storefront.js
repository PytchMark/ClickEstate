let listings = [];
const grid = document.getElementById('listingGrid');
const agencyHeader = document.getElementById('agencyHeader');

function card(l){
  const images = (()=>{try{return JSON.parse(l.image_urls||'[]')}catch{return[]}})();
  return `<article class='card listing-card'>
    <img src='${images[0] || 'https://placehold.co/600x400/111/fff?text=ClickEstate'}'>
    <h3>${l.title || 'Property Listing'} ${l.featured ? "<span class='tag'>Featured</span>" : ''}</h3>
    <p>${Formatters.money(l.price)} • ${l.bedrooms||0} bd • ${l.bathrooms||0} ba</p>
    <p class='muted'>${l.community || ''} ${l.parish || ''}</p>
    <button class='btn btn-primary' onclick='openListing("${l.listing_id}")'>View Listing</button>
  </article>`;
}

function render(){
  const parish = document.getElementById('parish').value;
  const ptype = document.getElementById('ptype').value;
  const beds = Number(document.getElementById('beds').value || 0);
  const maxPrice = Number(document.getElementById('maxPrice').value || Infinity);
  const filtered = listings.filter(l => (!parish || l.parish===parish) && (!ptype || l.property_type===ptype) && Number(l.bedrooms||0)>=beds && Number(l.price||0)<=maxPrice);
  grid.innerHTML = filtered.map(card).join('') || `<div class='card'>No listings yet. Verified inventory is loading.</div>`;
}

async function load(){
  try{
    grid.innerHTML = `<div class='skeleton' style='height:130px'></div>`;
    const ids = document.getElementById('agencyIds').value.trim();
    const data = await Api.request(`/api/public/listings?agencyIds=${encodeURIComponent(ids)}`);
    listings = data.listings;
    const first = ids.split(',')[0].trim();
    if (first) {
      const agency = await Api.request(`/api/public/agency/${first}`);
      agencyHeader.innerHTML = `<h2>${agency.agency.display_name || agency.agency.agency_id}</h2><p class='muted'>Trusted, verified, and response-ready listings.</p><a class='btn btn-primary' href='https://wa.me/${agency.agency.whatsapp||""}' target='_blank'>WhatsApp Us</a>`;
      UI.show(agencyHeader);
    }
    const parishes = [...new Set(listings.map(l=>l.parish).filter(Boolean))];
    document.getElementById('parish').innerHTML = `<option value=''>All Parishes</option>` + parishes.map(p=>`<option>${p}</option>`).join('');
    render();
  }catch(e){UI.toast(e.message)}
}

window.openListing = async (listingId) => {
  try {
    const { listing } = await Api.request(`/api/public/listing/${listingId}`);
    document.getElementById('modalContent').innerHTML = `<h2>${listing.title}</h2><p>${listing.description || ''}</p>
      <button class='btn btn-primary' onclick='requestViewing("${listing.agency_id}","${listing.realtor_id}","${listing.listing_id}","walk_in")'>Book Viewing</button>
      <button class='btn' onclick='requestViewing("${listing.agency_id}","${listing.realtor_id}","${listing.listing_id}","live_video")'>Live Video Tour</button>`;
    UI.show(document.getElementById('modal'));
  } catch(e){UI.toast(e.message)}
};

window.requestViewing = async (agencyId,realtorId,listingId,type) => {
  const customer_name = prompt('Your name');
  const customer_phone = prompt('Phone number');
  if (!customer_name || !customer_phone) return;
  try {
    await Api.request(`/api/public/agency/${agencyId}/requests`, { method: 'POST', body: JSON.stringify({ customer_name, customer_phone, realtor_id: realtorId, listing_id: listingId, request_type: type }) });
    UI.toast('Request sent. Realtor will respond fast.');
    UI.hide(document.getElementById('modal'));
  } catch(e){UI.toast(e.message)}
};

document.getElementById('loadBtn').onclick = load;
['parish','ptype','beds','maxPrice'].forEach(id => document.getElementById(id).addEventListener('input', render));
document.getElementById('closeModal').onclick = () => UI.hide(document.getElementById('modal'));
