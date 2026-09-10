const { BaseProvider } = require('./base-provider');
const { ExternalProductApiClient } = require('../services/external-product-api-client');

class AmazonProvider extends BaseProvider {
  constructor(options = {}) {
    const { apiClient, ...rest } = options || {};
    super({
      name: 'amazon',
      storeName: 'Amazon',
      mode: 'mock',
      ...rest
    });
    this.apiClient = apiClient || new ExternalProductApiClient();
  }

  canHandleUrl(url) {
    if (!this.isValidHttpUrl(url)) {
      return false;
    }

    // Only Amazon India hosts (apex or subdomains) to avoid matching
    // lookalike domains such as fakeamazon.in.evil.com.
    let hostname = '';
    try {
      hostname = new URL(String(url).trim()).hostname.toLowerCase();
    } catch (error) {
      return false;
    }
    if (hostname !== 'amazon.in' && !hostname.endsWith('.amazon.in')) {
      return false;
    }

    const lower = String(url).trim().toLowerCase();
    return lower.includes('/dp/') || lower.includes('/gp/product/') || lower.includes('/gp/');
  }

  extractProductId(url) {
    if (!this.canHandleUrl(url)) {
      return null;
    }

    const match = String(url).match(/(?:dp|gp\/product)\/([A-Z0-9]{10,})/i) ||
      String(url).match(/(?:dp|gp\/product)\/([A-Za-z0-9]{10,})/i);

    return match ? match[1] : null;
  }

  async fetchProduct(url) {
    if (!this.canHandleUrl(url)) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_STORE',
          message: 'This is not a supported Amazon India product URL.'
        }
      };
    }

    const productId = this.extractProductId(url);
    if (!productId) {
      return {
        success: false,
        error: {
          code: 'INVALID_PRODUCT_URL',
          message: 'Could not extract a valid Amazon product ID from the URL.'
        }
      };
    }

    // Live lookup when a product-data API key is configured; otherwise the
    // clearly-labeled mock below remains for tests and offline development.
    if (this.apiClient && typeof this.apiClient.isConfigured === 'function' && this.apiClient.isConfigured()) {
      return this.fetchLiveProduct(url, productId);
    }

    return this.fetchMockProduct(url, productId);
  }

  async fetchLiveProduct(url, productId) {
    let result;
    try {
      result = await this.apiClient.fetchAmazonProduct({ asin: productId, url });
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Live product data is temporarily unavailable. Please try again later.'
        }
      };
    }

    if (!result || !result.ok || !result.data) {
      return {
        success: false,
        error: result && result.error ? result.error : {
          code: 'PRODUCT_NOT_FOUND',
          message: "We couldn't find this product. Please check the product link and try again."
        }
      };
    }

    return {
      success: true,
      product: this.normalizeProduct(this.buildLiveProduct(url, productId, result.data))
    };
  }

  buildLiveProduct(url, productId, data) {
    const price = this.toFiniteNumber(data.price_value) ?? this.toFiniteNumber(data.price);
    const mrp = this.toFiniteNumber(data.list_price_value)
      ?? this.toFiniteNumber(data.list_price)
      ?? this.toFiniteNumber(data.mrp_value)
      ?? this.toFiniteNumber(data.mrp);
    const discountPercent = this.toFiniteNumber(data.discount_percent)
      ?? this.toFiniteNumber(data.discount)
      ?? (mrp && price && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null);
    const rating = this.toRating(data.rating);
    const reviewCount = this.toReviewCount(data.review_count, data.reviews_count, data.ratings_count);
    const availability = typeof data.stock === 'string' && data.stock
      ? data.stock
      : typeof data.availability === 'string' && data.availability
        ? data.availability
        : typeof data.delivery === 'string' && data.delivery
          ? `Delivery: ${data.delivery}`
          : 'Unknown';
    const description = Array.isArray(data.features) && data.features.length > 0
      ? data.features.filter((item) => typeof item === 'string' && item).join(' ')
      : typeof data.description === 'string' && data.description
        ? data.description
        : '';
    const image = typeof data.image_url === 'string' && data.image_url
      ? data.image_url
      : Array.isArray(data.images) && typeof data.images[0] === 'string'
        ? data.images[0]
        : '';
    const seller = data.seller && typeof data.seller.name === 'string' ? data.seller.name : '';

    const product = {
      id: `external-amazon-${productId}`,
      source: 'amazon',
      sourceType: 'live',
      externalId: data.asin || productId,
      url: data.url || url,
      name: data.title || 'Unknown Product',
      description,
      image,
      brand: typeof data.brand === 'string' ? data.brand : '',
      category: 'electronics',
      rating,
      reviewCount,
      availability,
      currency: 'INR',
      offers: price !== null && price > 0 ? [{
        storeId: 'amazon',
        storeName: seller ? `Amazon (${seller})` : 'Amazon',
        price,
        currency: 'INR',
        url: data.url || url,
        availability,
        lastUpdated: new Date().toISOString()
      }] : [],
      fetchedAt: new Date().toISOString()
    };
    if (mrp !== null && mrp > 0) {
      product.mrp = mrp;
    }
    if (discountPercent !== null && discountPercent >= 0) {
      product.discountPercent = discountPercent;
    }
    return product;
  }

  fetchMockProduct(url, productId) {
    // This is intentionally a demo/mock implementation until a real authorized Amazon API is configured.
    return {
      success: true,
      product: this.normalizeProduct({
        id: `external-amazon-${productId}`,
        source: 'amazon',
        sourceType: 'mock',
        externalId: productId,
        url: url,
        name: 'Demo Amazon Product',
        description: 'This is development/mock Amazon data. Add a real authorized provider to replace it.',
        image: 'images/placeholders/product-placeholder.svg',
        brand: 'Amazon',
        category: 'electronics',
        rating: 4.6,
        reviewCount: 1284,
        availability: 'Demo data',
        currency: 'INR',
        offers: [{
          storeId: 'amazon',
          storeName: 'Amazon',
          price: 29999,
          currency: 'INR',
          url,
          availability: 'Demo data',
          lastUpdated: new Date().toISOString()
        }],
        fetchedAt: new Date().toISOString()
      })
    };
  }
}

module.exports = { AmazonProvider };
