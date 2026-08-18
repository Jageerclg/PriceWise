const { BaseProvider } = require('./base-provider');

class AmazonProvider extends BaseProvider {
  constructor(options = {}) {
    super({
      name: 'amazon',
      storeName: 'Amazon',
      mode: 'mock',
      ...options
    });
  }

  canHandleUrl(url) {
    if (!this.isValidHttpUrl(url)) {
      return false;
    }

    const normalized = String(url).trim();
    const lower = normalized.toLowerCase();
    return lower.includes('amazon.in') && (
      lower.includes('/dp/') || lower.includes('/gp/product/') || lower.includes('/gp/')
    );
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
