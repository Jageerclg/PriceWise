// PriceWise - Same-product matching service (deterministic, no AI).
// Decides whether two listings (e.g. Amazon vs Flipkart) describe the SAME
// physical product, including variant attributes. Conservative by design:
// when confidence is insufficient the listings do NOT match.

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(\d+)\s*(gb|tb|mb)\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a comparable identity from a listing title + brand.
 * The model key keeps variant attributes (storage, color, size) so that
 * different variants of one model family never match each other.
 */
function buildIdentity(title, brand) {
  const cleanBrand = normalizeText(brand);
  let modelKey = normalizeText(title);
  if (cleanBrand) {
    modelKey = modelKey
      .split(' ')
      .filter((token) => token && !cleanBrand.split(' ').includes(token))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return { brand: cleanBrand, modelKey };
}

/**
 * Conservative same-product check. Both listings need a non-empty brand
 * and an identical model key (which embeds variant attributes).
 */
function isSameProduct(a, b) {
  const left = buildIdentity(a && a.title, a && a.brand);
  const right = buildIdentity(b && b.title, b && b.brand);
  if (!left.brand || !right.brand || left.brand !== right.brand) {
    return false;
  }
  if (!left.modelKey || !right.modelKey || left.modelKey !== right.modelKey) {
    return false;
  }
  return true;
}

/**
 * Find candidates matching the target listing. Returns matches only;
 * callers report "could not be confirmed" when the list is empty.
 */
function findMatches(target, candidates) {
  if (!target || !Array.isArray(candidates)) {
    return [];
  }
  return candidates.filter((candidate) => candidate && isSameProduct(target, candidate));
}

module.exports = { normalizeText, buildIdentity, isSameProduct, findMatches };
