function normalizeUrl(value) {
  return String(value || '').trim();
}

function toCandidateList(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}

    return text
      .split(/\r?\n|,(?=\s*(?:https?:\/\/|blob:|\/))/)
      .map((item) => item.trim());
  }

  return [];
}

export function normalizeImageUrls(value) {
  const seen = new Set();
  const list = [];

  for (const item of toCandidateList(value)) {
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
