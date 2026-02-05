function buildRealtorSummary(listings = [], requests = []) {
  const activeListings = listings.filter((l) => l.status === 'available').length;
  const closed = requests.filter((r) => r.status === 'closed').length;
  const byStatus = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const kpis = {
    totalListings: listings.length,
    activeListings,
    totalRequests: requests.length,
    closedRequests: closed,
    conversionRate: requests.length ? Math.round((closed / requests.length) * 100) : 0
  };
  const chart = ['new', 'contacted', 'booked', 'closed', 'no_show'].map((status) => ({ status, count: byStatus[status] || 0 }));
  return { kpis, chart };
}

function buildAdminSummary(profiles = [], listings = [], requests = []) {
  const agencies = new Set(profiles.map((p) => p.agency_id)).size;
  return {
    agencies,
    realtors: profiles.length,
    listings: listings.length,
    requests: requests.length,
    activeProfiles: profiles.filter((p) => p.status === 'active').length
  };
}

module.exports = { buildRealtorSummary, buildAdminSummary };
