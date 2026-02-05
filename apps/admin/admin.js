const login = document.getElementById('login');
const dash = document.getElementById('dash');

adminLogin.onclick = async () => {
  try {
    const data = await Api.request('/api/admin/login', { method:'POST', body: JSON.stringify({ username: adminUser.value, password: adminPass.value }) });
    Api.setToken(data.token); await loadDashboard(); UI.hide(login); UI.show(dash);
  } catch(e){ UI.toast(e.message); }
};

async function loadDashboard(){
  const summary = await Api.request('/api/admin/summary');
  document.getElementById('summary').innerHTML = Object.entries(summary.summary).map(([k,v])=>`<div class='card'><div class='muted'>${k}</div><h3>${v}</h3></div>`).join('');
  await loadAgenciesList();
}

async function loadAgenciesList(){
  const search = document.getElementById('search').value;
  const data = await Api.request(`/api/admin/agencies?page=1&pageSize=25&search=${encodeURIComponent(search)}`);
  document.getElementById('agencies').innerHTML = `<table class='table'><tr><th>Agency</th><th>Members</th></tr>${data.agencies.map(a=>`<tr><td>${a.agency_id}</td><td>${a.members.map(m=>`${m.display_name||m.realtor_id} (${m.status})`).join('<br>')}</td></tr>`).join('')}</table>`;
}

loadAgencies.onclick = loadAgenciesList;
createAgency.onclick = async () => {
  await Api.request('/api/admin/agencies', { method:'POST', body: JSON.stringify({ agency_id:cAgency.value, realtor_id:cRealtor.value, profile_email:cEmail.value, password:cPass.value, display_name:cRealtor.value, role:'agency_admin', branding_tier:'starter' }) });
  UI.toast('Agency created'); loadAgenciesList();
};
resetPass.onclick = async () => {
  await Api.request('/api/admin/reset-password', { method:'POST', body: JSON.stringify({ agency_id:rAgency.value, realtor_id:rRealtor.value, password:rPass.value })});
  UI.toast('Password reset');
};
exportCsv.onclick = async () => {
  const data = await Api.request('/api/admin/agencies?page=1&pageSize=100');
  const lines = ['agency_id,realtor_id,display_name,status'];
  data.agencies.forEach(a => a.members.forEach(m => lines.push([a.agency_id,m.realtor_id,m.display_name,m.status].join(','))));
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='agencies.csv'; a.click(); URL.revokeObjectURL(url);
};
