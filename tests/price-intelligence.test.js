// PriceWise - Price intelligence tests.
// Pure logic and service tests use fixtures and a fake snapshot model.
// No live DataBlue calls; nothing touches the production database.

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const {
  toFiniteNumber,
  calculateDiscount,
  getBestOffer,
  summarizeSnapshots,
  compareWithPrevious
} = require('../server/services/discount-utils.js');
const {
  SnapshotService,
  normalizeIdentity,
  clampDays
} = require('../server/services/snapshot-service.js');
const {
  buildIdentity,
  isSameProduct,
  findMatches
} = require('../server/services/product-matching-service.js');

// Fake Mongoose-like snapshot model with chainable query stubs.
function createFakeSnapshots(initialDocs = []) {
  const docs = initialDocs.map((doc, index) => ({
    _id: `snap-${index + 1}`,
    capturedAt: new Date(Date.now() - index * 86400000),
    ...doc
  }));
  function matches(doc, query) {
    return Object.entries(query || {}).every(([key, condition]) => {
      if (condition && typeof condition === 'object' && '$gte' in condition) {
        return new Date(doc[key]) >= new Date(condition.$gte);
      }
      return doc[key] === condition;
    });
  }
  return {
    docs,
    db: {},
    findOne(query) {
      const found = docs.filter((d) => matches(d, query)).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))[0] || null;
      return { sort: () => ({ lean: async () => (found ? { ...found } : null) }) };
    },
    find(query) {
      let rows = docs.filter((d) => matches(d, query)).sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
      return {
        sort: () => ({
          limit: (n) => ({ lean: async () => rows.slice(0, n).map((d) => ({ ...d })) })
        })
      };
    },
    async create(data) {
      const doc = { _id: `snap-${docs.length + 1}`, ...data };
      docs.push(doc);
      return { ...doc };
    },
    async aggregate(pipeline) {
      let rows = docs.slice();
      for (const stage of pipeline) {
        if (stage.$match) {
          rows = rows.filter((d) => matches(d, stage.$match));
        } else if (stage.$sort) {
          const [[key, dir]] = Object.entries(stage.$sort);
          const get = (d) => (key === 'doc.capturedAt' ? d.capturedAt : d[key.replace(/^doc\./, '')]);
          rows = rows.slice().sort((a, b) => (new Date(get(a)) - new Date(get(b))) * (dir === -1 ? -1 : 1));
        } else if (stage.$group) {
          const seen = new Map();
          for (const d of rows) {
            if (!seen.has(d.externalProductId)) {
              seen.set(d.externalProductId, { _id: d.externalProductId, doc: { ...d } });
            }
          }
          rows = [...seen.values()];
        } else if (stage.$limit) {
          rows = rows.slice(0, stage.$limit);
        }
      }
      return rows;
    }
  };
}

function daysAgo(n, price, extra = {}) {
  return {
    store: 'amazon',
    externalProductId: 'B0TESTHIST',
    productName: 'History Fixture Phone',
    brand: 'FixtureBrand',
    price,
    mrp: 79900,
    discountPercent: ((79900 - price) / 79900) * 100,
    currency: 'INR',
    url: 'https://www.amazon.in/dp/B0TESTHIST',
    availability: 'In Stock',
    capturedAt: new Date(Date.now() - n * 86400000),
    ...extra
  };
}

const liveProduct = {
  id: 'external-amazon-B0LIVE1',
  source: 'amazon',
  sourceType: 'live',
  externalId: 'B0LIVE1',
  url: 'https://www.amazon.in/dp/B0LIVE1',
  name: 'Live Fixture Phone',
  brand: 'FixtureBrand',
  mrp: 79900,
  currency: 'INR',
  availability: 'In Stock',
  image: 'https://example.test/img.jpg',
  fetchedAt: new Date().toISOString(),
  offers: [{ storeId: 'amazon', storeName: 'Amazon', price: 69900, currency: 'INR', url: 'https://www.amazon.in/dp/B0LIVE1', availability: 'In Stock' }]
};

test('Discount calculation', async (t) => {
  await t.test('computes amount and percentage from price and MRP', () => {
    const result = calculateDiscount(69900, 79900);
    assert.strictEqual(result.discountAmount, 10000);
    assert.ok(Math.abs(result.discountPercent - 12.5156) < 0.001);
  });

  await t.test('returns null for zero, missing, or invalid MRP', () => {
    assert.strictEqual(calculateDiscount(69900, 0), null);
    assert.strictEqual(calculateDiscount(69900, null), null);
    assert.strictEqual(calculateDiscount(69900, undefined), null);
    assert.strictEqual(calculateDiscount(69900, 'not-a-price'), null);
    assert.strictEqual(calculateDiscount('not-a-price', 79900), null);
  });

  await t.test('returns null when MRP is not greater than price', () => {
    assert.strictEqual(calculateDiscount(79900, 79900), null);
    assert.strictEqual(calculateDiscount(89900, 79900), null);
  });

  await t.test('parses currency display strings without NaN', () => {
    const result = calculateDiscount('₹69,900', 'INR 79,900');
    assert.strictEqual(result.discountAmount, 10000);
    assert.strictEqual(toFiniteNumber('garbage'), null);
    assert.strictEqual(toFiniteNumber(NaN), null);
  });

  await t.test('getBestOffer picks the lowest valid offer', () => {
    const best = getBestOffer({ offers: [{ price: 74999 }, { price: 69900 }, { price: 'bad' }, { price: 0 }] });
    assert.strictEqual(best.price, 69900);
    assert.strictEqual(getBestOffer({ offers: [] }), null);
    assert.strictEqual(getBestOffer(null), null);
  });
});

test('History statistics', async (t) => {
  const fixtures = [daysAgo(30, 79900), daysAgo(20, 74999), daysAgo(10, 72999), daysAgo(1, 69900)];

  await t.test('identifies lowest, highest, and average prices', () => {
    const stats = summarizeSnapshots(fixtures);
    assert.strictEqual(stats.dataPoints, 4);
    assert.strictEqual(stats.lowestPrice, 69900);
    assert.strictEqual(stats.highestPrice, 79900);
    assert.strictEqual(stats.averagePrice, (79900 + 74999 + 72999 + 69900) / 4);
    assert.ok(stats.lowestPriceDate);
    assert.ok(stats.highestPriceDate);
    assert.strictEqual(stats.points.length, 4);
  });

  await t.test('returns null when no usable history exists', () => {
    assert.strictEqual(summarizeSnapshots([]), null);
    assert.strictEqual(summarizeSnapshots([{ price: 'bad' }]), null);
    assert.strictEqual(summarizeSnapshots(null), null);
  });

  await t.test('compares current vs previous price and discount', () => {
    const comparison = compareWithPrevious(
      { price: 69900, mrp: 79900 },
      { price: 74999, mrp: 79900 }
    );
    assert.strictEqual(comparison.priceChange, -5099);
    assert.ok(comparison.currentDiscountPercent > comparison.previousDiscountPercent);
    assert.ok(Math.abs(comparison.discountChangePoints - 6.38) < 0.05);
  });

  await t.test('comparison returns null without sufficient data', () => {
    assert.strictEqual(compareWithPrevious(null, { price: 1 }), null);
    assert.strictEqual(compareWithPrevious({ price: 1 }, null), null);
    assert.strictEqual(compareWithPrevious({ price: 'bad' }, { price: 1 }), null);
  });
});

test('Snapshot recording', async (t) => {
  await t.test('records live products with identity and discount', async () => {
    const fake = createFakeSnapshots();
    const service = new SnapshotService({ snapshotModel: fake });
    const result = await service.recordSnapshot(liveProduct);
    assert.strictEqual(result.stored, true);
    const saved = fake.docs[0];
    assert.strictEqual(saved.store, 'amazon');
    assert.strictEqual(saved.externalProductId, 'B0LIVE1');
    assert.strictEqual(saved.price, 69900);
    assert.strictEqual(saved.mrp, 79900);
    assert.ok(saved.discountPercent > 0);
    assert.strictEqual('password' in saved, false);
  });

  await t.test('never records mock, failed, or identity-less products', async () => {
    const fake = createFakeSnapshots();
    const service = new SnapshotService({ snapshotModel: fake });
    assert.strictEqual((await service.recordSnapshot({ ...liveProduct, sourceType: 'mock' })).stored, false);
    assert.strictEqual((await service.recordSnapshot(null)).stored, false);
    assert.strictEqual((await service.recordSnapshot({ ...liveProduct, externalId: '' })).stored, false);
    assert.strictEqual((await service.recordSnapshot({ ...liveProduct, offers: [] })).stored, false);
    assert.strictEqual(fake.docs.length, 0);
  });

  await t.test('skips recent identical duplicates but records price changes', async () => {
    const fake = createFakeSnapshots();
    const service = new SnapshotService({ snapshotModel: fake });
    assert.strictEqual((await service.recordSnapshot(liveProduct)).stored, true);
    const duplicate = await service.recordSnapshot(liveProduct);
    assert.strictEqual(duplicate.stored, false);
    assert.strictEqual(duplicate.skipped, true);
    const changed = await service.recordSnapshot({
      ...liveProduct,
      offers: [{ ...liveProduct.offers[0], price: 68900 }]
    });
    assert.strictEqual(changed.stored, true);
    assert.strictEqual(fake.docs.length, 2);
  });

  await t.test('records again after the dedup window passes', async () => {
    const old = { ...daysAgo(0, 69900), store: 'amazon', externalProductId: 'B0LIVE1', mrp: 79900, capturedAt: new Date(Date.now() - 7 * 3600000) };
    const fake = createFakeSnapshots([old]);
    const service = new SnapshotService({ snapshotModel: fake });
    const result = await service.recordSnapshot(liveProduct);
    assert.strictEqual(result.stored, true);
  });
});

test('History retrieval', async (t) => {
  await t.test('returns current, stats, and bounded points', async () => {
    const fake = createFakeSnapshots([daysAgo(29, 79900), daysAgo(20, 74999), daysAgo(10, 72999), daysAgo(1, 69900)]);
    const service = new SnapshotService({ snapshotModel: fake });
    const result = await service.getHistory('amazon', 'B0TESTHIST', 30);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.history.days, 30);
    assert.strictEqual(result.history.dataAvailable, true);
    assert.strictEqual(result.history.current.price, 69900);
    assert.strictEqual(result.history.lowestPrice, 69900);
    assert.strictEqual(result.history.highestPrice, 79900);
    assert.strictEqual(result.history.dataPointCount, 4);
  });

  await t.test('reports unavailable cleanly when no history exists', async () => {
    const fake = createFakeSnapshots();
    const service = new SnapshotService({ snapshotModel: fake });
    const result = await service.getHistory('flipkart', 'itmNONE', 30);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.history.dataAvailable, false);
    assert.strictEqual(result.history.current, null);
    assert.strictEqual(result.history.dataPointCount, 0);
  });

  await t.test('rejects bad identity and clamps days', async () => {
    const fake = createFakeSnapshots();
    const service = new SnapshotService({ snapshotModel: fake });
    assert.strictEqual((await service.getHistory('ebay', 'x', 30)).success, false);
    // The service accepts any non-empty id (Mongo equality match is
    // injection-safe); the strict identifier pattern is enforced by the
    // route layer. Unknown ids simply report no data.
    const unknown = await service.getHistory('amazon', '!!!', 30);
    assert.strictEqual(unknown.success, true);
    assert.strictEqual(unknown.history.dataAvailable, false);
    const clamped = await service.getHistory('amazon', 'B0TESTHIST', 5000);
    assert.strictEqual(clamped.history.days, 90);
  });

  await t.test('clampDays bounds the window between 1 and 90', () => {
    assert.strictEqual(clampDays(30), 30);
    assert.strictEqual(clampDays(0), 1);
    assert.strictEqual(clampDays(-5), 1);
    assert.strictEqual(clampDays(5000), 90);
    assert.strictEqual(clampDays('oops'), 30);
    assert.strictEqual(normalizeIdentity('Amazon', 'B0X').store, 'amazon');
    assert.strictEqual(normalizeIdentity('ebay', 'B0X'), null);
  });
});

test('Same-product matching', async (t) => {
  await t.test('matches identical listings across stores', () => {
    assert.strictEqual(
      isSameProduct(
        { title: 'Samsung Galaxy S24 Ultra 5G (Titanium Black, 12GB RAM, 256GB Storage)', brand: 'Samsung' },
        { title: 'Samsung Galaxy S24 Ultra 5G Titanium Black 12GB RAM 256GB Storage', brand: 'samsung' }
      ),
      true
    );
  });

  await t.test('never matches different storage variants', () => {
    assert.strictEqual(
      isSameProduct(
        { title: 'Apple iPhone 15 Pro Max 256 GB', brand: 'Apple' },
        { title: 'Apple iPhone 15 Pro Max 512 GB', brand: 'Apple' }
      ),
      false
    );
    assert.strictEqual(
      isSameProduct(
        { title: 'Samsung Galaxy S24 Ultra 256GB', brand: 'Samsung' },
        { title: 'Samsung Galaxy S24 Ultra 512GB', brand: 'Samsung' }
      ),
      false
    );
  });

  await t.test('never matches different colors or brands', () => {
    assert.strictEqual(
      isSameProduct(
        { title: 'Sony WH-1000XM5 Black', brand: 'Sony' },
        { title: 'Sony WH-1000XM5 Silver', brand: 'Sony' }
      ),
      false
    );
    assert.strictEqual(
      isSameProduct(
        { title: 'Galaxy S24 Ultra 256GB', brand: 'Samsung' },
        { title: 'Galaxy S24 Ultra 256GB', brand: 'Xiaomi' }
      ),
      false
    );
  });

  await t.test('requires a brand and model key on both sides', () => {
    assert.strictEqual(isSameProduct({ title: 'Phone X', brand: '' }, { title: 'Phone X', brand: '' }), false);
    assert.strictEqual(isSameProduct(null, { title: 'Phone X', brand: 'B' }), false);
    assert.strictEqual(findMatches({ title: 'Phone X 128GB', brand: 'B' }, [
      { title: 'Phone X 128GB', brand: 'B' },
      { title: 'Phone X 256GB', brand: 'B' }
    ]).length, 1);
  });

  await t.test('model keys ignore spacing around storage units', () => {
    assert.strictEqual(buildIdentity('Phone 256 GB', 'B').modelKey, buildIdentity('Phone 256GB', 'B').modelKey);
  });
});

test('History and compare routes - HTTP contract', async (t) => {
  // Stub the snapshot service module in the require cache BEFORE routers load.
  const servicePath = require.resolve('../server/services/snapshot-service.js');
  const realServiceEntry = require.cache[servicePath];
  const behaviors = { getHistory: null, getLatestByStore: null };
  function FakeSnapshotService() {
    return behaviors;
  }
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: { SnapshotService: FakeSnapshotService, normalizeIdentity: () => null, clampDays: (d) => d }
  };
  delete require.cache[require.resolve('../server/routes/products.js')];
  const productsRouter = require('../server/routes/products.js');
  if (realServiceEntry) {
    require.cache[servicePath] = realServiceEntry;
  } else {
    delete require.cache[servicePath];
  }

  const app = express();
  app.use(express.json());
  app.use('/api/products', productsRouter);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  async function get(pathname) {
    const response = await fetch(`${base}${pathname}`);
    return { status: response.status, payload: await response.json().catch(() => null) };
  }

  await t.test('GET history rejects unknown stores and bad identifiers', async () => {
    assert.strictEqual((await get('/api/products/history/ebay/B0X')).status, 400);
    assert.strictEqual((await get('/api/products/history/amazon/!!!')).status, 400);
  });

  await t.test('GET history returns stats envelope', async () => {
    behaviors.getHistory = async () => ({
      success: true,
      history: {
        store: 'amazon', externalProductId: 'B0X', days: 30, dataAvailable: true,
        current: { price: 69900, mrp: 79900, discountPercent: 12.5, capturedAt: new Date().toISOString() },
        lowestPrice: 69900, lowestPriceDate: new Date().toISOString(),
        highestPrice: 74999, highestPriceDate: new Date().toISOString(),
        averagePrice: 72449.5, dataPointCount: 2, dataPoints: []
      }
    });
    const { status, payload } = await get('/api/products/history/amazon/B0X?days=30');
    assert.strictEqual(status, 200);
    assert.strictEqual(payload.history.lowestPrice, 69900);
    assert.strictEqual(payload.history.dataAvailable, true);
  });

  await t.test('GET compare reports best price across matched stores', async () => {
    behaviors.getHistory = async () => ({
      success: true,
      history: {
        current: {
          price: 69900, mrp: 79900, discountPercent: 12.5,
          capturedAt: new Date().toISOString(),
          name: 'Samsung Galaxy S24 Ultra 5G Titanium Black 12GB RAM 256GB Storage',
          brand: 'Samsung', url: 'https://www.amazon.in/dp/B0X', availability: 'In Stock'
        }
      }
    });
    behaviors.getLatestByStore = async () => [{
      store: 'flipkart', externalProductId: 'itmMATCH1',
      productName: 'Samsung Galaxy S24 Ultra 5G (Titanium Black, 12GB RAM, 256GB Storage)',
      brand: 'Samsung', price: 71499, mrp: 79900, discountPercent: 10.56,
      url: 'https://www.flipkart.com/x/p/itmMATCH1', availability: 'In Stock',
      capturedAt: new Date().toISOString()
    }];
    const { status, payload } = await get('/api/products/compare?store=amazon&externalProductId=B0X');
    assert.strictEqual(status, 200);
    assert.strictEqual(payload.comparison.matched, true);
    assert.strictEqual(payload.comparison.best.store, 'amazon');
    assert.strictEqual(payload.comparison.best.price, 69900);
    assert.strictEqual(payload.comparison.priceDifference, 1599);
    assert.strictEqual(payload.comparison.entries.length, 2);
  });

  await t.test('GET compare reports a single store honestly', async () => {
    behaviors.getHistory = async () => ({
      success: true,
      history: {
        current: {
          price: 69900, mrp: null, discountPercent: null, capturedAt: new Date().toISOString(),
          name: 'Sony WH-1000XM5 Black', brand: 'Sony', url: 'https://www.amazon.in/dp/B0X', availability: 'In Stock'
        }
      }
    });
    behaviors.getLatestByStore = async () => [];
    const { status, payload } = await get('/api/products/compare?store=amazon&externalProductId=B0X');
    assert.strictEqual(status, 200);
    assert.strictEqual(payload.comparison.matched, false);
    assert.match(payload.comparison.message, /only one store/i);
  });

  await t.test('GET compare validates input and handles service failure', async () => {
    assert.strictEqual((await get('/api/products/compare?store=ebay&externalProductId=B0X')).status, 400);
    assert.strictEqual((await get('/api/products/compare?store=amazon')).status, 400);
    behaviors.getHistory = async () => ({ success: false, error: { code: 'SERVER_ERROR', message: 'x' } });
    behaviors.getLatestByStore = async () => { throw new Error('db down'); };
    const { status } = await get('/api/products/compare?store=amazon&externalProductId=B0X');
    assert.strictEqual(status, 500);
  });
});

console.log('Price intelligence tests completed!');
