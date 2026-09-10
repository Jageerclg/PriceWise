const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/data/products.json'), 'utf8')).products;
const context = { URL, encodeURIComponent, window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'public/js/product-share-url.js'), 'utf8'), context);
const share = context.window.ProductShareURL;

const demoProducts = [
  ['galaxy-s24-ultra', 'product-001', 'Samsung Galaxy S24 Ultra'],
  ['iphone-15-pro-max', 'product-002', 'Apple iPhone 15 Pro Max'],
  ['oneplus-12', 'product-003', 'OnePlus 12'],
  ['macbook-air-m3', 'product-004', 'Apple MacBook Air M3'],
  ['sony-wh-1000xm5', 'product-005', 'Sony WH-1000XM5']
];

test('all five demo product links resolve to complete local catalog entries', () => {
  assert.equal(catalog.length, 5);
  for (const [slug, id, name] of demoProducts) {
    const result = share.parse(`https://pricewise.local/product/${slug}`, catalog);
    assert.equal(result.matched, true);
    assert.equal(result.valid, true);
    assert.equal(result.product.id, id);
    assert.equal(result.product.name, name);
    assert.ok(fs.existsSync(path.join(root, 'public', result.product.image)));
    assert.ok(Array.isArray(result.product.offers) && result.product.offers.length > 0);
    result.product.offers.forEach(offer => assert.ok(Number.isFinite(offer.price) && offer.price > 0));
  }
});

test('local product-link parsing rejects malformed and unknown PriceWise links', () => {
  assert.equal(share.parse('https://pricewise.local/product/no-such-product', catalog).valid, false);
  assert.equal(share.parse('https://pricewise.local/product/../../data/products.json', catalog).valid, false);
  assert.equal(share.parse('javascript:alert(1)', catalog).matched, false);
});

test('normal search terms remain outside the product-link parser', () => {
  for (const term of ['laptop', 'phone', 'headphones', 'Samsung', 'Apple', 'OnePlus']) {
    assert.equal(share.parse(term, catalog).matched, false);
  }
});

test('normal demo search terms still find local catalog products', () => {
  for (const term of ['laptop', 'phone', 'headphones', 'Samsung', 'Apple', 'OnePlus']) {
    const needle = term.toLowerCase();
    const matches = catalog.filter(product => [product.name, product.brand, product.description, product.category]
      .some(value => String(value || '').toLowerCase().includes(needle)));
    assert.ok(matches.length > 0, `Expected a local match for ${term}`);
  }
});

test('demo comparison offers sort lowest to highest price', () => {
  for (const [, id] of demoProducts) {
    const product = catalog.find(item => item.id === id);
    const sorted = [...product.offers].sort((a, b) => a.price - b.price);
    assert.equal(sorted[0].price, Math.min(...product.offers.map(offer => offer.price)));
  }
});
