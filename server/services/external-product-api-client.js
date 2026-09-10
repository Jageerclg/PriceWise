// PriceWise - External product-data API client (Phase 5)
// The ONLY module that talks to the third-party product-data provider
// (DataBlue). Providers delegate transport here; routes never call it
// directly. The API key stays server-side and is never logged or returned.

const DEFAULT_BASE_URL = 'https://api.datablue.dev';
const DEFAULT_TIMEOUT_MS = 20000;
const AMAZON_PRODUCTS_PATH = '/v1/data/amazon/products';
const FLIPKART_PRODUCT_PATH = '/v1/data/flipkart/product';

class ExternalProductApiClient {
  constructor({
    apiKey,
    baseUrl,
    timeoutMs,
    fetchImpl
  } = {}) {
    this.apiKey = typeof apiKey === 'string' ? apiKey : process.env.PRODUCT_DATA_API_KEY || '';
    this.baseUrl = typeof baseUrl === 'string' && baseUrl
      ? baseUrl.replace(/\/+$/, '')
      : (process.env.PRODUCT_DATA_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const parsedTimeout = Number(timeoutMs !== undefined ? timeoutMs : process.env.PRODUCT_DATA_API_TIMEOUT_MS);
    this.timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? Math.min(parsedTimeout, 30000)
      : DEFAULT_TIMEOUT_MS;
    this.fetchImpl = typeof fetchImpl === 'function'
      ? fetchImpl
      : (...args) => fetch(...args);
  }

  isConfigured() {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
  }

  async fetchAmazonProduct({ asin, url } = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: 'Live product service is not configured.'
        }
      };
    }

    const cleanAsin = typeof asin === 'string' ? asin.trim() : '';
    const cleanUrl = typeof url === 'string' ? url.trim() : '';
    if (!cleanAsin && !cleanUrl) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PRODUCT_URL',
          message: 'Could not extract a valid Amazon product ID from the URL.'
        }
      };
    }

    const body = { domain: 'amazon.in', detail_level: 'full' };
    if (cleanAsin) {
      body.asin = cleanAsin;
    } else {
      body.url = cleanUrl;
    }

    const result = await this.postJson(AMAZON_PRODUCTS_PATH, body);
    if (!result.ok) {
      return result;
    }

    const products = result.data && Array.isArray(result.data.products) ? result.data.products : [];
    const match = cleanAsin
      ? products.find((item) => item && String(item.asin || '').toUpperCase() === cleanAsin.toUpperCase()) || products[0]
      : products[0];
    if (!match) {
      return {
        ok: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: "We couldn't find this product. Please check the product link and try again."
        }
      };
    }

    return { ok: true, data: match };
  }

  async fetchFlipkartProduct({ url, pid } = {}) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: 'Live product service is not configured.'
        }
      };
    }

    const cleanUrl = typeof url === 'string' ? url.trim() : '';
    const cleanPid = typeof pid === 'string' ? pid.trim() : '';
    if (!cleanUrl && !cleanPid) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PRODUCT_URL',
          message: 'Could not extract a valid Flipkart product ID from the URL.'
        }
      };
    }

    // Prefer the complete product URL; fall back to the extracted PID.
    const body = cleanUrl ? { url: cleanUrl } : { pid: cleanPid };
    const result = await this.postJson(FLIPKART_PRODUCT_PATH, body);
    if (!result.ok) {
      return result;
    }

    const product = result.data && result.data.product;
    if (!product || typeof product !== 'object') {
      return {
        ok: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: "We couldn't find this product. Please check the product link and try again."
        }
      };
    }

    return { ok: true, data: product };
  }

  async postJson(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Key is sent as a header only. It is never logged or returned.
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body || {}),
        signal: controller.signal
      });
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Live product data is temporarily unavailable. Please try again later.'
        }
      };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Live product service is not configured.'
        }
      };
    }

    if (response.status === 402 || response.status === 429) {
      return {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Live product lookup limit reached. Please try again later.'
        }
      };
    }

    if (response.status === 404 || response.status === 422) {
      return {
        ok: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: "We couldn't find this product. Please check the product link and try again."
        }
      };
    }

    if (!response.ok || response.status >= 500) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Live product data is temporarily unavailable. Please try again later.'
        }
      };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PROVIDER_RESPONSE',
          message: 'Live product data is temporarily unavailable. Please try again later.'
        }
      };
    }

    if (!payload || typeof payload !== 'object' || payload.success !== true) {
      return {
        ok: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: "We couldn't find this product. Please check the product link and try again."
        }
      };
    }

    return { ok: true, data: payload };
  }
}

module.exports = { ExternalProductApiClient };
