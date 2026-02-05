window.Api = {
  token: localStorage.getItem('clickestate_token') || null,
  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
    return data;
  },
  setToken(token){ this.token = token; localStorage.setItem('clickestate_token', token); },
  clearToken(){ this.token = null; localStorage.removeItem('clickestate_token'); }
};
