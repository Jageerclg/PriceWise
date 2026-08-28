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
      fetchedAt: data.fetchedAt || new Date().toISOString()
    };
  }
}

module.exports = { BaseProvider };
