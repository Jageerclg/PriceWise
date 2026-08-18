const { BaseProvider } = require('./base-provider');

class FlipkartProvider extends BaseProvider {
  constructor(options = {}) {
    super({
      name: 'flipkart',
      storeName: 'Flipkart',
      mode: 'mock',
      ...options
    });
  }

  canHandleUrl(url) {
    if (!this.isValidHttpUrl(url)) {
      return false;
    }

    const lower = String(url).trim().toLowerCase();
    return lower.includes('flipkart.com') && (lower.includes('/p/') || lower.includes('/itm'));
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
