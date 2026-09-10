// PriceWise - Phase 5 live product-data tests.
// Transport is fully mocked: the API key is NEVER required for this suite.
// A single optional live test runs only when PRODUCT_DATA_API_KEY is set
// and never prints the key.

const assert = require('assert');
const { describe, it } = require('node:test');
const express = require('express');

// Deterministic suite: never inherit a developer key from the environment.
delete process.env.PRODUCT_DATA_API_KEY;
delete process.env.PRODUCT_DATA_API_BASE_URL;

const { ExternalProductApiClient } = require('../server/services/external-product-api-client');
const { AmazonProvider } = require('../server/providers/amazon-provider');
const { FlipkartProvider } = require('../server/providers/flipkart-provider');
const { ProductService } = require('../server/services/product-service');

const AMAZON_URL = 'https://www.amazon.in/dp/B09X3P5QK5';
const FLIPKART_URL = 'https://www.flipkart.com/realme-11x-5g/p/itm4f657b89a34b7';

function unconfiguredClient() {
  return new ExternalProductApiClient({ apiKey: '', baseUrl: 'https://api.example.test' });
}

function mockFetch(handler) {
  return async (url, options) => handler(url, options);
}

function okJson(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const AMAZON_ROW = {
  asin: 'B09X3P5QK5',
  title: 'Real Test Phone',
  url: AMAZON_URL,
  price: '₹79,999',
  price_value: 79999,
  rating: 4.3,
  review_count: 2180,
  image_url: 'https://m.media-amazon.com/images/I/test.jpg',
  brand: 'TestBrand',
  delivery: 'Tomorrow'
};

const FLIPKART_DOC = {
  pid: 'itm4f657b89a34b7',
  title: 'Real Test Gadget',
  brand: 'GadgetCo',
  url: FLIPKART_URL,
  price: 'INR 1,499',
  price_value: 1499,
  mrp: 'INR 4,999',
  discount_percent: 70,
  rating: 4.2,
  ratings_count: 5821,
  reviews_count: 640,
  availability: 'InStock',
  seller: { name: 'Example Retail' },
  highlights: ['Bluetooth calling', '7 day battery'],
  images: ['https://rukminim1.flixcart.com/image/test.jpg']
};

describe('Phase 5 - DataBlue transport', () => {
  it('builds the Amazon request with ASIN + amazon.in domain and Bearer auth', async () => {
    let seen;
    const client = new ExternalProductApiClient({
      apiKey: 'test-key-123',
      baseUrl: 'https://api.example.test',
      fetchImpl: mockFetch(async (url, options) => {
        seen = { url, options };
        return okJson({ success: true, products: [AMAZON_ROW] });
      })
    });
    const result = await client.fetchAmazonProduct({ asin: 'B09X3P5QK5', url: AMAZON_URL });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(seen.url, 'https://api.example.test/v1/data/amazon/products');
    assert.strictEqual(seen.options.method, 'POST');
    assert.strictEqual(seen.options.headers['Content-Type'], 'application/json');
    assert.strictEqual(seen.options.headers.Authorization, 'Bearer test-key-123');
    const body = JSON.parse(seen.options.body);
    assert.strictEqual(body.asin, 'B09X3P5QK5');
    assert.strictEqual(body.domain, 'amazon.in');
  });

  it('builds the Flipkart request preferring the full URL', async () => {
    let seenBody;
    const client = new ExternalProductApiClient({
      apiKey: 'test-key-123',
      fetchImpl: mockFetch(async (url, options) => {
        seenBody = JSON.parse(options.body);
        return okJson({ success: true, product: FLIPKART_DOC });
      })
    });
    const result = await client.fetchFlipkartProduct({ url: FLIPKART_URL, pid: 'itm4f657b89a34b7' });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(seenBody.url, FLIPKART_URL);
    assert.strictEqual(result.data.pid, 'itm4f657b89a34b7');
  });

  it('maps 401/403 to PROVIDER_AUTH_ERROR without leaking the secret', async () => {
    const client = new ExternalProductApiClient({
      apiKey: 'super-secret-key',
      fetchImpl: mockFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    });
    const result = await client.fetchAmazonProduct({ asin: 'B09X3P5QK5' });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'PROVIDER_AUTH_ERROR');
    assert.strictEqual(JSON.stringify(result).includes('super-secret-key'), false);
  });

  it('maps 402/429 quota exhaustion to RATE_LIMITED', async () => {
    for (const status of [402, 429]) {
      const client = new ExternalProductApiClient({
        apiKey: 'k',
        fetchImpl: mockFetch(async () => ({ ok: false, status, json: async () => ({}) }))
      });
      const result = await client.fetchFlipkartProduct({ url: FLIPKART_URL });
      assert.strictEqual(result.error.code, 'RATE_LIMITED');
      assert.match(result.error.message, /limit reached/i);
    }
  });

  it('maps 404/422 to PRODUCT_NOT_FOUND', async () => {
    const client = new ExternalProductApiClient({
      apiKey: 'k',
      fetchImpl: mockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    });
    const result = await client.fetchAmazonProduct({ asin: 'B000000000' });
    assert.strictEqual(result.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('maps 5xx provider failure to PROVIDER_UNAVAILABLE', async () => {
    const client = new ExternalProductApiClient({
      apiKey: 'k',
      fetchImpl: mockFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    });
    const result = await client.fetchAmazonProduct({ asin: 'B09X3P5QK5' });
    assert.strictEqual(result.error.code, 'PROVIDER_UNAVAILABLE');
  });

  it('maps network timeout to PROVIDER_UNAVAILABLE', async () => {
    const client = new ExternalProductApiClient({
      apiKey: 'k',
      timeoutMs: 50,
      // Honor AbortSignal like the real fetch: reject when aborted.
      fetchImpl: mockFetch(async (url, options) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          if (options && options.signal) {
            if (options.signal.aborted) {
              clearTimeout(timer);
              reject(new Error('aborted'));
            } else {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('aborted'));
              });
            }
          }
        });
        return okJson({ success: true, products: [] });
      })
    });
    const result = await client.fetchAmazonProduct({ asin: 'B09X3P5QK5' });
    assert.strictEqual(result.error.code, 'PROVIDER_UNAVAILABLE');
  });

  it('maps malformed provider JSON to INVALID_PROVIDER_RESPONSE', async () => {
    const client = new ExternalProductApiClient({
      apiKey: 'k',
      fetchImpl: mockFetch(async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new Error('bad json'); }
      }))
    });
    const result = await client.fetchFlipkartProduct({ url: FLIPKART_URL });
    assert.strictEqual(result.error.code, 'INVALID_PROVIDER_RESPONSE');
  });

  it('reports missing API key without any request', async () => {
    let called = false;
    const client = new ExternalProductApiClient({
      apiKey: '',
      fetchImpl: mockFetch(async () => { called = true; throw new Error('must not call'); })
    });
    const result = await client.fetchAmazonProduct({ asin: 'B09X3P5QK5' });
    assert.strictEqual(result.error.code, 'PROVIDER_NOT_CONFIGURED');
    assert.strictEqual(called, false);
  });
});

describe('Phase 5 - live provider normalization', () => {
  function liveAmazonProvider(row) {
    return new AmazonProvider({
      apiClient: new ExternalProductApiClient({
        apiKey: 'k',
        fetchImpl: mockFetch(async () => okJson({ success: true, products: [row] }))
      })
    });
  }

  it('normalizes a live Amazon product with sourceType live', async () => {
    const provider = liveAmazonProvider(AMAZON_ROW);
    const result = await provider.fetchProduct(AMAZON_URL);
    assert.strictEqual(result.success, true);
    const product = result.product;
    assert.strictEqual(product.source, 'amazon');
    assert.strictEqual(product.sourceType, 'live');
    assert.strictEqual(product.externalId, 'B09X3P5QK5');
    assert.strictEqual(product.name, 'Real Test Phone');
    assert.strictEqual(product.offers[0].price, 79999);
    assert.strictEqual(product.currency, 'INR');
    assert.strictEqual(product.rating, 4.3);
    assert.strictEqual(product.reviewCount, 2180);
    assert.strictEqual(product.brand, 'TestBrand');
    assert.ok(product.fetchedAt);
  });

  it('normalizes a live Flipkart product with MRP and discount', async () => {
    const provider = new FlipkartProvider({
      apiClient: new ExternalProductApiClient({
        apiKey: 'k',
        fetchImpl: mockFetch(async () => okJson({ success: true, product: FLIPKART_DOC }))
      })
    });
    const result = await provider.fetchProduct(FLIPKART_URL);
    assert.strictEqual(result.success, true);
    const product = result.product;
    assert.strictEqual(product.source, 'flipkart');
    assert.strictEqual(product.sourceType, 'live');
    assert.strictEqual(product.externalId, 'itm4f657b89a34b7');
    assert.strictEqual(product.offers[0].price, 1499);
    assert.strictEqual(product.mrp, 4999);
    assert.strictEqual(product.discountPercent, 70);
    assert.strictEqual(product.reviewCount, 640);
  });

  it('handles missing optional fields without fabricating values', async () => {
    const provider = liveAmazonProvider({ asin: 'B09X3P5QK5', title: 'Bare Product' });
    const result = await provider.fetchProduct(AMAZON_URL);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.product.rating, null);
    assert.strictEqual(result.product.reviewCount, null);
    assert.strictEqual(result.product.brand, '');
    // Existing project convention: missing descriptions fall back to the
    // standard placeholder text rather than an empty string.
    assert.strictEqual(result.product.description, 'No description available.');
    assert.deepStrictEqual(result.product.offers, []);
    assert.strictEqual('mrp' in result.product, false);
  });

  it('parses display-string prices and clamps ratings', async () => {
    const provider = liveAmazonProvider({
      asin: 'B09X3P5QK5',
      title: 'Priced',
      price: '₹1,29,999',
      rating: 9.9,
      review_count: '1,234'
    });
    const result = await provider.fetchProduct(AMAZON_URL);
    assert.strictEqual(result.product.offers[0].price, 129999);
    assert.strictEqual(result.product.rating, null);
    assert.strictEqual(result.product.reviewCount, 1234);
  });

  it('surfaces product-not-found from the provider', async () => {
    const provider = new AmazonProvider({
      apiClient: new ExternalProductApiClient({
        apiKey: 'k',
        fetchImpl: mockFetch(async () => okJson({ success: true, products: [] }))
      })
    });
    const result = await provider.fetchProduct(AMAZON_URL);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('falls back to labeled mock data when no API key is configured', async () => {
    const provider = new AmazonProvider({ apiClient: unconfiguredClient() });
    const result = await provider.fetchProduct(AMAZON_URL);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.product.sourceType, 'mock');
  });

  it('rejects lookalike marketplace domains', async () => {
    const amazon = new AmazonProvider({ apiClient: unconfiguredClient() });
    const flipkart = new FlipkartProvider({ apiClient: unconfiguredClient() });
    assert.strictEqual(amazon.canHandleUrl('https://fakeamazon.in.evil.com/dp/B09X3P5QK5'), false);
    assert.strictEqual(flipkart.canHandleUrl('https://flipkart.com.evil.com/x/p/itm123'), false);
    assert.strictEqual(amazon.canHandleUrl('https://www.amazon.in/dp/B09X3P5QK5'), true);
    assert.strictEqual(flipkart.canHandleUrl(FLIPKART_URL), true);
  });
});

describe('Phase 5 - service guards and route statuses', () => {
  it('rejects javascript: and data: URLs before any provider call', async () => {
    const service = new ProductService({ providerMode: 'mock' });
    for (const bad of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'notaurl']) {
      const result = await service.importProductFromUrl(bad);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.code, 'INVALID_URL');
    }
  });

  it('rejects unsupported marketplaces', async () => {
    const service = new ProductService({ providerMode: 'mock' });
    const result = await service.importProductFromUrl('https://example.com/product/123');
    assert.strictEqual(result.error.code, 'UNSUPPORTED_STORE');
  });

  it('maps error codes to HTTP statuses', () => {
    const { errorStatus } = require('../server/routes/products');
    assert.strictEqual(errorStatus({ code: 'PRODUCT_NOT_FOUND' }), 404);
    assert.strictEqual(errorStatus({ code: 'RATE_LIMITED' }), 429);
    assert.strictEqual(errorStatus({ code: 'PROVIDER_UNAVAILABLE' }), 503);
    assert.strictEqual(errorStatus({ code: 'PROVIDER_AUTH_ERROR' }), 503);
    assert.strictEqual(errorStatus({ code: 'INVALID_URL' }), 400);
    assert.strictEqual(errorStatus({ code: 'UNSUPPORTED_STORE' }), 400);
    assert.strictEqual(errorStatus({ code: 'NOPE' }), 400);
  });

  it('route returns 400 JSON envelope for invalid URLs', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/products', require('../server/routes/products'));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'javascript:alert(1)' })
      });
      assert.strictEqual(response.status, 400);
      const payload = await response.json();
      assert.strictEqual(payload.success, false);
      assert(payload.error && payload.error.code);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('Phase 5 - optional live integration', { skip: process.env.PRODUCT_DATA_API_KEY ? false : 'PRODUCT_DATA_API_KEY not set; skipping live provider test.' }, () => {
  it('imports a real product when a key is configured', async () => {
    const service = new ProductService({ providerMode: 'live' });
    const result = await service.importProductFromUrl(AMAZON_URL);
    // Live data varies; assert only the stable contract, never secrets.
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.product.sourceType, 'live');
    assert.ok(result.product.name && result.product.name !== 'Unknown Product');
    assert.strictEqual(JSON.stringify(result).includes(process.env.PRODUCT_DATA_API_KEY), false);
  });
});
