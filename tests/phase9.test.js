const assert = require('assert');
const { ProductService } = require('../server/services/product-service');
const { AmazonProvider } = require('../server/providers/amazon-provider');
const { FlipkartProvider } = require('../server/providers/flipkart-provider');

const amazonUrl = 'https://www.amazon.in/dp/B09X3P5QK5';
const amazonAltUrl = 'https://www.amazon.in/gp/product/B09X3P5QK5';
const flipkartUrl = 'https://www.flipkart.com/realme-11x-5g/p/itm4f657b89a34b7';
const invalidUrl = 'hello';
const unsupportedUrl = 'https://example.com/product/123';
const javascriptUrl = 'javascript:alert(1)';

describe('Phase 9 product integration architecture', () => {
  it('detects valid Amazon product URLs', () => {
    const provider = new AmazonProvider();
    assert.strictEqual(provider.canHandleUrl(amazonUrl), true);
    assert.strictEqual(provider.canHandleUrl(amazonAltUrl), true);
    assert.strictEqual(provider.extractProductId(amazonUrl), 'B09X3P5QK5');
  });

  it('detects valid Flipkart product URLs', () => {
    const provider = new FlipkartProvider();
    assert.strictEqual(provider.canHandleUrl(flipkartUrl), true);
    assert.strictEqual(provider.extractProductId(flipkartUrl).length > 0, true);
  });

  it('rejects invalid and unsupported URLs', () => {
    const provider = new AmazonProvider();
    assert.strictEqual(provider.canHandleUrl(invalidUrl), false);
    assert.strictEqual(provider.canHandleUrl(unsupportedUrl), false);
    assert.strictEqual(provider.canHandleUrl(javascriptUrl), false);
  });

  it('builds a normalized product record for mock and backend-ready flows', async () => {
    const service = new ProductService();
    const product = service.normalizeProduct({
      id: 'external-amazon-B09X3P5QK5',
      name: 'Demo Amazon Product',
      externalId: 'B09X3P5QK5',
      url: amazonUrl,
      source: 'amazon',
      sourceType: 'mock',
      offers: [{ storeName: 'Amazon', price: 29999, currency: 'INR', url: amazonUrl }]
    });

    assert.strictEqual(product.sourceType, 'mock');
    assert.strictEqual(product.offers[0].storeName, 'Amazon');
    assert.strictEqual(product.currency, 'INR');
  });

  it('returns a graceful provider-not-configured error for unsupported providers', async () => {
    const service = new ProductService({ providerMode: 'mock' });
    const result = await service.importProductFromUrl(unsupportedUrl);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'UNSUPPORTED_STORE');
  });
});
