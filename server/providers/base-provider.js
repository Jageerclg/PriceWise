class BaseProvider {
  constructor({ name = 'base', storeName = 'Store', mode = 'mock' } = {}) {
    this.name = name;
    this.storeName = storeName;
    this.mode = mode;
  }

  canHandleUrl(url) {
    return Boolean(url && typeof url === 'string' && this.isValidHttpUrl(url));
  }

  isValidHttpUrl(value) {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('javascript:')) {
      return false;
    }

    try {
      const url = new URL(trimmed);
      return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
    } catch (error) {
      return false;
    }
  }

  extractProductId(url) {
    return null;
  }

  /**
   * Coerce unknown provider values to a finite number or null.
   * Handles numbers, "₹1,499" / "INR 4,999" display strings and
   * comma/decimal formatting. Never returns NaN.
   */
  toFiniteNumber(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      if (!cleaned) {
        return null;
      }
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  /**
   * Normalize a provider rating to a 0-5 number or null.
   * Never fabricates a rating from missing data.
   */
  toRating(value) {
    const numeric = this.toFiniteNumber(value);
    if (numeric === null || numeric < 0 || numeric > 5) {
      return null;
    }
    return numeric;
  }

  /**
   * Normalize a provider review count to a non-negative integer or null.
   */
  toReviewCount(...candidates) {
    for (const candidate of candidates) {
      const numeric = this.toFiniteNumber(candidate);
      if (numeric !== null && numeric >= 0) {
        return Math.floor(numeric);
      }
    }
    return null;
  }

  async fetchProduct(url) {
    return {
      success: false,
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'No authorized provider is configured for this store.'
      }
    };
  }

  normalizeProduct(data) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const offers = Array.isArray(data.offers) ? data.offers.map((offer) => ({
      storeId: offer && offer.storeId ? offer.storeId : this.name,
      storeName: offer && offer.storeName ? offer.storeName : this.storeName,
      price: Number(offer && offer.price) || 0,
      currency: offer && offer.currency ? offer.currency : 'INR',
      url: offer && offer.url ? offer.url : data.url || '#',
      availability: offer && offer.availability ? offer.availability : 'Unknown',
      lastUpdated: offer && offer.lastUpdated ? offer.lastUpdated : new Date().toISOString()
    })) : [];

    return {
      id: data.id || `external-${this.name}-${Date.now()}`,
      source: data.source || this.name,
      sourceType: data.sourceType || this.mode,
      externalId: data.externalId || this.extractProductId(data.url || ''),
      url: data.url || '',
      name: data.name || 'Unknown Product',
      description: data.description || 'No description available.',
      image: data.image || 'images/placeholders/product-placeholder.svg',
      brand: data.brand || '',
      category: data.category || 'general',
      rating: typeof data.rating === 'number' ? data.rating : null,
      reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : null,
      availability: data.availability || (offers[0] && offers[0].availability) || 'Unknown',
      currency: data.currency || (offers[0] && offers[0].currency) || 'INR',
      offers,
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      // Live provider extras (MRP/discount) pass through only when present,
      // so existing normalized shapes stay byte-identical otherwise.
      ...(typeof data.mrp === 'number' && Number.isFinite(data.mrp) && data.mrp > 0
        ? { mrp: data.mrp }
        : {}),
      ...(typeof data.discountPercent === 'number' && Number.isFinite(data.discountPercent) && data.discountPercent >= 0
        ? { discountPercent: data.discountPercent }
        : {})
    };
  }
}

module.exports = { BaseProvider };
