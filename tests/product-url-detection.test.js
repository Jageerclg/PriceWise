// PriceWise - Phase 5 URL detection tests.
// Loads the REAL frontend public/js/product-url.js in a sandbox and
// cross-checks it against the REAL backend providers: both layers must
// agree on every URL (supported, unsupported, or rejected).
const assert = require('assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { AmazonProvider } = require('../server/providers/amazon-provider');
const { FlipkartProvider } = require('../server/providers/flipkart-provider');

function loadFrontendModule() {
  const filePath = path.join(__dirname, '..', 'public', 'js', 'product-url.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {}, console, URL };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__ProductURLModule = ProductURLModule;`, sandbox);
  return sandbox.__ProductURLModule;
}

const Frontend = loadFrontendModule();
const amazonBackend = new AmazonProvider();
const flipkartBackend = new FlipkartProvider();

const ASIN = 'B0XXXXXXXX'; // 10-char shape, realistic without claiming existence
const PID = 'itmXXXXXXXX';

const validAmazonUrls = [
  'https://www.amazon.in/dp/B0XXXXXXXX',
  'https://amazon.in/dp/B0XXXXXXXX',
  'https://m.amazon.in/dp/B0XXXXXXXX',
  'https://www.amazon.in/gp/product/B0XXXXXXXX',
  'https://www.amazon.in/Some-Product-Name/dp/B0XXXXXXXX?tag=test',
  'https://www.amazon.in/dp/B0XXXXXXXX#reviews'
];

const validFlipkartUrls = [
  'https://www.flipkart.com/product-name/p/itmXXXXXXXX',
  'https://flipkart.com/product-name/p/itmXXXXXXXX',
  'https://m.flipkart.com/product-name/p/itmXXXXXXXX',
  'https://www.flipkart.com/product-name/p/itmXXXXXXXX?pid=TEST',
  'https://www.flipkart.com/product-name/p/itmXXXXXXXX#reviews'
];

const maliciousUrls = [
  'https://fakeamazon.in/dp/B0XXXXXXXX',
  'https://amazon.in.evil.com/dp/B0XXXXXXXX',
  'https://fakeflipkart.com/product/p/itmXXXXXXXX',
  'https://flipkart.com.evil.com/product/p/itmXXXXXXXX'
];

describe('Phase 5 fix - Amazon India URL detection', () => {
  it('accepts apex, www and mobile hosts with /dp/ and /gp/product/ paths', () => {
    for (const url of validAmazonUrls) {
      const validation = Frontend.validateProductUrl(url);
      assert.strictEqual(validation.isValid, true, url);
      assert.strictEqual(validation.supported, true, url);
      assert.strictEqual(validation.storeKey, 'amazon', url);
      assert.strictEqual(validation.productId, ASIN, url);
    }
  });

  it('backend agrees on every valid Amazon URL', () => {
    for (const url of validAmazonUrls) {
      assert.strictEqual(amazonBackend.canHandleUrl(url), true, url);
      assert.strictEqual(amazonBackend.extractProductId(url), ASIN, url);
      assert.strictEqual(flipkartBackend.canHandleUrl(url), false, url);
    }
  });
});

describe('Phase 5 fix - Flipkart URL detection', () => {
  it('accepts apex, www and mobile hosts with /p/ paths, queries and fragments', () => {
    for (const url of validFlipkartUrls) {
      const validation = Frontend.validateProductUrl(url);
      assert.strictEqual(validation.isValid, true, url);
      assert.strictEqual(validation.supported, true, url);
      assert.strictEqual(validation.storeKey, 'flipkart', url);
      assert.ok(validation.productId && validation.productId.length > 0, url);
    }
  });

  it('backend agrees on every valid Flipkart URL', () => {
    for (const url of validFlipkartUrls) {
      assert.strictEqual(flipkartBackend.canHandleUrl(url), true, url);
      assert.ok(flipkartBackend.extractProductId(url), url);
      assert.strictEqual(amazonBackend.canHandleUrl(url), false, url);
    }
  });
});

describe('Phase 5 fix - security rejections', () => {
  it('rejects lookalike/malicious domains on both layers', () => {
    for (const url of maliciousUrls) {
      const validation = Frontend.validateProductUrl(url);
      assert.strictEqual(validation.supported, false, url);
      assert.strictEqual(amazonBackend.canHandleUrl(url), false, url);
      assert.strictEqual(flipkartBackend.canHandleUrl(url), false, url);
    }
  });

  it('rejects dangerous schemes', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<h1>x</h1>', 'file:///etc/passwd']) {
      const validation = Frontend.validateProductUrl(url);
      assert.strictEqual(validation.isValid, false, url);
      assert.strictEqual(validation.supported, false, url);
    }
  });

  it('treats other marketplaces as valid-but-unsupported, not as errors', () => {
    const validation = Frontend.validateProductUrl('https://www.amazon.com/dp/B0XXXXXXXX');
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.supported, false);
  });

  it('does not treat normal search text as a supported store URL', () => {
    const validation = Frontend.validateProductUrl('samsung galaxy s24 ultra');
    assert.strictEqual(validation.supported, false);
  });
});
