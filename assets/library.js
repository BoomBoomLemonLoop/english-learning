export function matchesQuery(item, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = `${item.title} ${item.description} ${item.text} ${(item.tags ?? []).join(' ')} ${item.date ?? ''}`.toLocaleLowerCase();
  return terms.every(term => text.includes(term));
}
export function orderItems(items, order = 'newest') {
  return [...items].sort((a, b) => {
    if (order === 'title') return a.title.localeCompare(b.title, 'en');
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    return (order === 'oldest' ? 1 : -1) * (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title, 'en') || a.url.localeCompare(b.url, 'en');
  });
}

