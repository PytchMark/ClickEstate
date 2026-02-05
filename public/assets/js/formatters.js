window.Formatters = {
  money(value){ return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits:0 }).format(Number(value || 0)); },
  date(value){ return value ? new Date(value).toLocaleDateString() : '—'; }
};
