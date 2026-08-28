const { AmazonProvider } = require('../providers/amazon-provider');
const { FlipkartProvider } = require('../providers/flipkart-provider');

class ProductService {
  constructor({ providerMode = 'mock' } = {}) {
    this.providerMode = providerMode;
    this.providers = {
      amazon: new AmazonProvider({ mode: providerMode }),
      flipkart: new FlipkartProvider({ mode: providerMode })
    };
  }

  normalizeProduct(product) {
    if (!product || typeof product !== 'object') {
      return null;
    }

    const normalizedOffers = Array.isArray(product.offers) ? product.offers.map((offer) => ({
      storeId: offer && offer.storeId ? offer.storeId : product.source || 'provider',
      storeName: offer && offer.storeName ? offer.storeName : product.source || 'Provider',
      price: Number(offer && offer.price) || 0,
      currency: offer && offer.currency ? offer.currency : 'INR',
      url: offer && offer.url ? offer.url : product.url || '#',
      availability: offer && offer.availability ? offer.availability : 'Unknown',
      lastUpdated: offer && offer.lastUpdated ? offer.lastUpdated : new Date().toISOString()
    })) : [];

    return {
      id: product.id || `external-${product.source || 'provider'}-${Date.now()}`,
      source: product.source || 'provider',
      sourceType: product.sourceType || this.providerMode,
      externalId: product.externalId || '',
      url: product.url || '',
      name: product.name || 'Unknown Product',
      description: product.description || 'No description available.',
      image: product.image || 'images/placeholders/product-placeholder.svg',
      brand: product.brand || '',
      category: product.category || 'general',
      rating: typeof product.rating === 'number' ? product.rating : null,
      reviewCount: typeof product.reviewCount === 'number' ? product.reviewCount : null,
      availability: product.availability || (normalizedOffers[0] && normalizedOffers[0].availability) || 'Unknown',
      currency: product.currency || (normalizedOffers[0] && normalizedOffers[0].currency) || 'INR',
      offers: normalizedOffers,
      fetchedAt: product.fetchedAt || new Date().toISOString()
    };
  }

  async importProductFromUrl(url) {
    if (typeof url !== 'string' || !url.trim()) {
      return {
        success: false,
        error: {
          code: 'EMPTY_URL',
          message: 'Please enter a product URL.'
        }
      };
    }

    const trimmed = url.trim();
    if (!this.isValidHttpUrl(trimmed)) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Please enter a valid HTTP or HTTPS URL.'
        }
      };
    }

    if (trimmed.toLowerCase().startsWith('javascript:')) {
      return {
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'JavaScript URLs are not allowed.'
        }
      };
    }

    const provider = this.getProviderForUrl(trimmed);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_STORE',
          message: 'This store is not supported yet. We currently support Amazon India and Flipkart only.'
        }
      };
    }

    try {
      const result = await provider.fetchProduct(trimmed);
      if (!result || !result.success || !result.product) {
        return {
          success: false,
          error: result && result.error ? result.error : {
            code: 'IMPORT_FAILED',
            message: 'Unable to retrieve this product.'
          }
        };
      }

      return {
        success: true,
        product: this.normalizeProduct(result.product),
        provider: provider.name,
        sourceType: result.product.sourceType || this.providerMode
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error && error.message ? error.message : 'A product lookup error occurred.'
        }
      };
    }
  }

  getProviderForUrl(url) {
    if (this.providers.amazon.canHandleUrl(url)) {
      return this.providers.amazon;
    }

    if (this.providers.flipkart.canHandleUrl(url)) {
      return this.providers.flipkart;
    }

    return null;
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
}

module.exports = { ProductService };
