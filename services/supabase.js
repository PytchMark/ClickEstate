const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function assertSupabaseEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing Supabase env vars: ${missing.join(', ')}`);
  }
}

function baseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function select(table, query = '', options = {}) {
  assertSupabaseEnv();
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { headers: { ...baseHeaders(), ...options.headers } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insert(table, payload, options = { returning: 'representation' }) {
  assertSupabaseEnv();
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...baseHeaders(), Prefer: `return=${options.returning || 'representation'}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function update(table, query, payload, options = { returning: 'representation' }) {
  assertSupabaseEnv();
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...baseHeaders(), Prefer: `return=${options.returning || 'representation'}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

module.exports = { assertSupabaseEnv, select, insert, update };
