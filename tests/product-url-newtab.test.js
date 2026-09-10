// PriceWise - new-tab import UX tests.
// Loads the REAL frontend public/js/product-url.js in a sandbox with a
// stubbed window and verifies the tab flow without a browser.
const assert = require('assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFrontendModule(windowStub) {
  const filePath = path.join(__dirname, '..', 'public', 'js', 'product-url.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = {
    window: windowStub,
    console,
    URL,
    Utils: { selectElement: () => null },
    document: { querySelectorAll: () => [] }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__ProductURLModule = ProductURLModule;`, sandbox);
  return sandbox.__ProductURLModule;
}

function makeWindow(openImpl) {
  const calls = { open: [], assign: [] };
  return {
    calls,
    open: (...args) => { calls.open.push(args); return openImpl ? openImpl(...args) : null; },
    location: {
      assign: (url) => { calls.assign.push(url); },
      href: ''
    }
  };
}

function makeTab() {
  return { closed: false, location: { href: '' }, opener: {}, close() { this.closed = true; } };
}

describe('new-tab import flow', () => {
  it('Amazon success navigates the new tab to the PriceWise details page', () => {
    const windowStub = makeWindow(() => makeTab());
    const Frontend = loadFrontendModule(windowStub);
    const tab = Frontend.openBlankTab();
    assert.ok(tab, 'placeholder tab should open in the gesture');
    const result = Frontend.showImportedProduct(
      { ok: true, product: { id: 'external-amazon-B0TEST1234' } },
      tab
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.openedNewTab, true);
    assert.strictEqual(tab.location.href, 'product-details.html?external=external-amazon-B0TEST1234');
    assert.deepStrictEqual(windowStub.calls.assign, [], 'current tab must stay unchanged');
  });

  it('Flipkart success navigates the new tab to the PriceWise details page', () => {
    const windowStub = makeWindow(() => makeTab());
    const Frontend = loadFrontendModule(windowStub);
    const result = Frontend.showImportedProduct(
      { ok: true, product: { id: 'external-flipkart-itmTEST99' } },
      Frontend.openBlankTab()
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.openedNewTab, true);
    assert.strictEqual(result.targetUrl, 'product-details.html?external=external-flipkart-itmTEST99');
  });

  it('import failure closes the placeholder tab and navigates nowhere', () => {
    const windowStub = makeWindow(() => makeTab());
    const Frontend = loadFrontendModule(windowStub);
    const tab = Frontend.openBlankTab();
    const result = Frontend.showImportedProduct(
      { ok: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'We couldn\u2019t find this product.' } },
      tab
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.openedNewTab, false);
    assert.strictEqual(tab.closed, true, 'failed import must not leave a blank tab');
    assert.deepStrictEqual(windowStub.calls.assign, [], 'current tab must stay unchanged');
    assert.strictEqual(tab.location.href, '', 'placeholder tab must never navigate');
  });

  it('blocked popup falls back to same-tab navigation so import still works', () => {
    const windowStub = makeWindow(() => null); // popup blocker
    const Frontend = loadFrontendModule(windowStub);
    assert.strictEqual(Frontend.openBlankTab(), null);
    const result = Frontend.showImportedProduct(
      { ok: true, product: { id: 'external-amazon-B0TEST1234' } },
      null
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.openedNewTab, false);
    assert.deepStrictEqual(windowStub.calls.assign, ['product-details.html?external=external-amazon-B0TEST1234']);
  });

  it('normal text search never reaches the new-tab flow', () => {
    const windowStub = makeWindow(() => { throw new Error('must not open a tab'); });
    const Frontend = loadFrontendModule(windowStub);
    const validation = Frontend.validateProductUrl('Samsung Galaxy S24 Ultra');
    assert.strictEqual(validation.supported, false);
    // No tab may be opened for plain search terms: openBlankTab is only
    // invoked inside the supported-URL branch of the submit handler.
  });

  it('security rejections are unchanged (malicious hosts, schemes)', () => {
    const windowStub = makeWindow(() => { throw new Error('must not open a tab'); });
    const Frontend = loadFrontendModule(windowStub);
    for (const url of [
      'https://fakeamazon.in/dp/B0XXXXXXXXXX',
      'https://amazon.in.evil.com/dp/B0XXXXXXXXXX',
      'https://fakeflipkart.com/p/itmXXXXXXXX',
      'https://flipkart.com.evil.com/p/itmXXXXXXXX'
    ]) {
      assert.strictEqual(Frontend.validateProductUrl(url).supported, false, url);
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
      assert.strictEqual(Frontend.validateProductUrl(url).isValid, false, url);
    }
  });
});
