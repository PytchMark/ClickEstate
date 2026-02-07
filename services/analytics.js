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

function buildDetailedAnalytics(listings = [], requests = [], profiles = []) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Requests by status
  const requestsByStatus = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  
  // Requests by type
  const requestsByType = requests.reduce((acc, r) => {
    acc[r.request_type] = (acc[r.request_type] || 0) + 1;
    return acc;
  }, {});
  
  // Listings by status
  const listingsByStatus = listings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  
  // Listings by property type
  const listingsByType = listings.reduce((acc, l) => {
    const type = l.property_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  // Price distribution
  const prices = listings.filter(l => l.price).map(l => Number(l.price));
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  
  // Daily requests for last 30 days
  const dailyRequests = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const count = requests.filter(r => r.created_at && r.created_at.startsWith(dateStr)).length;
    dailyRequests.push({ date: dateStr, count });
  }
  
  // Daily listings for last 30 days
  const dailyListings = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const count = listings.filter(l => l.created_at && l.created_at.startsWith(dateStr)).length;
    dailyListings.push({ date: dateStr, count });
  }
  
  // Recent activity
  const recentRequests = requests.filter(r => new Date(r.created_at) > sevenDaysAgo).length;
  const recentListings = listings.filter(l => new Date(l.created_at) > sevenDaysAgo).length;
  
  // Conversion funnel
  const newRequests = requestsByStatus['new'] || 0;
  const contactedRequests = requestsByStatus['contacted'] || 0;
  const bookedRequests = requestsByStatus['booked'] || 0;
  const closedRequests = requestsByStatus['closed'] || 0;
  
  // Top parishes
  const parishCounts = listings.reduce((acc, l) => {
    if (l.parish) {
      acc[l.parish] = (acc[l.parish] || 0) + 1;
    }
    return acc;
  }, {});
  const topParishes = Object.entries(parishCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([parish, count]) => ({ parish, count }));
  
  return {
    summary: {
      totalListings: listings.length,
      activeListings: listingsByStatus['available'] || 0,
      totalRequests: requests.length,
      closedRequests,
      conversionRate: requests.length ? Math.round((closedRequests / requests.length) * 100) : 0,
      avgPrice,
      minPrice,
      maxPrice
    },
    requestsByStatus,
    requestsByType,
    listingsByStatus,
    listingsByType,
    dailyRequests,
    dailyListings,
    recentActivity: {
      requests: recentRequests,
      listings: recentListings
    },
    conversionFunnel: {
      new: newRequests,
      contacted: contactedRequests,
      booked: bookedRequests,
      closed: closedRequests
    },
    topParishes,
    profiles: profiles ? {
      total: profiles.length,
      active: profiles.filter(p => p.status === 'active').length,
      byTier: profiles.reduce((acc, p) => {
        acc[p.branding_tier] = (acc[p.branding_tier] || 0) + 1;
        return acc;
      }, {})
    } : null
  };
}

module.exports = { buildRealtorSummary, buildAdminSummary, buildDetailedAnalytics };
