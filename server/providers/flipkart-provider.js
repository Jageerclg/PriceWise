const { BaseProvider } = require('./base-provider');
const { ExternalProductApiClient } = require('../services/external-product-api-client');

class FlipkartProvider extends BaseProvider {
  constructor(options = {}) {
    const { apiClient, ...rest } = options || {};
    super({
      name: 'flipkart',
      storeName: 'Flipkart',
      mode: 'mock',
      ...rest
    });
    this.apiClient = apiClient || new ExternalProductApiClient();
  }

  canHandleUrl(url) {
    if (!this.isValidHttpUrl(url)) {
      return false;
    }

    // Only Flipkart hosts (apex or subdomains) to avoid matching lookalike
    // domains such as flipkart.com.evil.com.
    let hostname = '';
    try {
      hostname = new URL(String(url).trim()).hostname.toLowerCase();
    } catch (error) {
      return false;
    }
    if (hostname !== 'flipkart.com' && !hostname.endsWith('.flipkart.com')) {
      return false;
    }

    const lower = String(url).trim().toLowerCase();
    return lower.includes('/p/') || lower.includes('/itm');
  }

  extractProductId(url) {
    if (!this.canHandleUrl(url)) {
      return null;
    }

    const match = String(url).match(/\/p\/([A-Za-z0-9]+)/i) ||
      String(url).match(/\/itm([A-Za-z0-9]+)/i);

    return match ? match[1] : null;
  }

  async fetchProduct(url) {
    if (!this.canHandleUrl(url)) {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_STORE',
          message: 'This is not a supported Flipkart product URL.'
        }
      };
    }

    const productId = this.extractProductId(url);
    if (!productId) {
      return {
        success: false,
        error: {
          code: 'INVALID_PRODUCT_URL',
          message: 'Could not extract a valid Flipkart product ID from the URL.'
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
      // Prefer the complete product URL; the client falls back to the PID.
      result = await this.apiClient.fetchFlipkartProduct({ url, pid: productId });
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
    const mrp = this.toFiniteNumber(data.mrp_value)
      ?? this.toFiniteNumber(data.mrp)
      ?? this.toFiniteNumber(data.original_price)
      ?? this.toFiniteNumber(data.original_price_value);
    const discountPercent = this.toFiniteNumber(data.discount_percent)
      ?? this.toFiniteNumber(data.discount)
      ?? (mrp && price && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null);
    const rating = this.toRating(data.rating);
    const reviewCount = this.toReviewCount(data.reviews_count, data.review_count, data.ratings_count);
    const availability = typeof data.availability === 'string' && data.availability
      ? data.availability
      : typeof data.is_available === 'boolean'
        ? (data.is_available ? 'In Stock' : 'Out of Stock')
        : typeof data.inStock === 'boolean'
          ? (data.inStock ? 'In Stock' : 'Out of Stock')
          : 'Unknown';
    const description = Array.isArray(data.highlights) && data.highlights.length > 0
      ? data.highlights.filter((item) => typeof item === 'string' && item).join(' ')
      : typeof data.productDescription === 'string' && data.productDescription
        ? data.productDescription
        : typeof data.description === 'string'
          ? data.description
          : '';
    const image = Array.isArray(data.images) && typeof data.images[0] === 'string'
      ? data.images[0]
      : typeof data.imageUrl === 'string'
        ? data.imageUrl
        : typeof data.image === 'string'
          ? data.image
          : '';
    const seller = data.seller && typeof data.seller.name === 'string' ? data.seller.name : '';

    const product = {
      id: `external-flipkart-${productId}`,
      source: 'flipkart',
      sourceType: 'live',
      externalId: data.pid || productId,
      url: data.url || url,
      name: data.title || 'Unknown Product',
      description,
      image,
      brand: typeof data.brand === 'string'
        ? data.brand
        : (typeof data.productBrand === 'string' ? data.productBrand : ''),
      category: 'electronics',
      rating,
      reviewCount,
      availability,
      currency: 'INR',
      offers: price !== null && price > 0 ? [{
        storeId: 'flipkart',
        storeName: seller ? `Flipkart (${seller})` : 'Flipkart',
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
    return {
      success: true,
      product: this.normalizeProduct({
        id: `external-flipkart-${productId}`,
        source: 'flipkart',
        sourceType: 'mock',
        externalId: productId,
        url,
        name: 'Demo Flipkart Product',
        description: 'This is development/mock Flipkart data. Add a real authorized provider to replace it.',
        image: 'images/placeholders/product-placeholder.svg',
        brand: 'Flipkart',
        category: 'electronics',
        rating: 4.5,
        reviewCount: 892,
        availability: 'Demo data',
        currency: 'INR',
        offers: [{
          storeId: 'flipkart',
          storeName: 'Flipkart',
          price: 28999,
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

module.exports = { FlipkartProvider };
