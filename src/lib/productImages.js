function normalizeUrl(value) {
  return String(value || '').trim();
}

export function normalizeImageUrls(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const list = [];

  for (const item of value) {
    const next = normalizeUrl(item);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    list.push(next);
  }

  return list;
}

export function parseImageUrlText(value) {
  return normalizeImageUrls(
    String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
  );
}

export function getProductImages(product) {
  const primary = normalizeUrl(product?.image_url);
  const gallery = normalizeImageUrls(product?.image_urls);

  if (!primary) return gallery;
  return [primary, ...gallery.filter((item) => item !== primary)];
}

export function getPrimaryProductImage(product) {
  return getProductImages(product)[0] || '';
}

export function mergeUniqueImageUrls(...groups) {
  return normalizeImageUrls(groups.flat());
}
