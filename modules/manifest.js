const ROUTE_ALIASES = {
  'background-characteristics-2025': 'backgroundcharacteristics',
  'fertility-rate-2025': 'fertilityrate',
};

export function currentSlug() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function routeForPage(page) {
  return ROUTE_ALIASES[page.slug] || page.route || page.slug;
}

export async function loadManifest() {
  try {
    const response = await fetch(new URL('../manifest.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) return { pages: [] };
    return response.json();
  } catch (error) {
    return { pages: [] };
  }
}

export function manifestEntryForSlug(manifest, slug) {
  return (manifest?.pages || []).find(page => page.slug === slug) || null;
}
