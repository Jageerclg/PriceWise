const express = require('express');
const { ProductService } = require('../services/product-service');
const { SnapshotService, clampDays } = require('../services/snapshot-service');
const { isSameProduct } = require('../services/product-matching-service');

const router = express.Router();
const productService = new ProductService();
const snapshotService = new SnapshotService();

// Map application error codes to HTTP statuses so the frontend can
// distinguish "not found" from "rate limited" from "provider down".
// Validation-shaped problems stay 400; everything unknown stays 500.
const STATUS_BY_CODE = {
  EMPTY_URL: 400,
  INVALID_URL: 400,
  INVALID_PRODUCT_URL: 400,
  UNSUPPORTED_STORE: 400,
  VALIDATION_ERROR: 400,
  PRODUCT_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_AUTH_ERROR: 503,
  PROVIDER_NOT_CONFIGURED: 503,
  IMPORT_FAILED: 502,
  API_ERROR: 502,
  SERVER_ERROR: 500
};

function errorStatus(error) {
  if (error && error.code && STATUS_BY_CODE[error.code]) {
    return STATUS_BY_CODE[error.code];
  }
  return 400;
}

router.post('/import', async (req, res) => {
  const { url } = req.body || {};
  const result = await productService.importProductFromUrl(url);

  if (!result.success) {
    return res.status(errorStatus(result.error)).json({
      success: false,
      error: result.error
    });
  }

  return res.json({
    success: true,
    product: result.product
  });
});

const SUPPORTED_HISTORY_STORES = ['amazon', 'flipkart'];
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function validateIdentity(store, externalProductId) {
  const cleanStore = typeof store === 'string' ? store.trim().toLowerCase() : '';
  const cleanId = typeof externalProductId === 'string' ? externalProductId.trim() : '';
  if (!SUPPORTED_HISTORY_STORES.includes(cleanStore)) {
    return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Unknown store. Supported stores: amazon, flipkart.' } };
  }
  if (!EXTERNAL_ID_PATTERN.test(cleanId)) {
    return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid product identifier.' } };
  }
  return { ok: true, store: cleanStore, externalProductId: cleanId };
}

// GET /api/products/history/:store/:externalProductId?days=30
// Real stored snapshots only; never fabricated.
router.get('/history/:store/:externalProductId', async (req, res) => {
  const identity = validateIdentity(req.params.store, req.params.externalProductId);
  if (!identity.ok) {
    return res.status(400).json({ success: false, error: identity.error });
  }
  const result = await snapshotService.getHistory(
    identity.store,
    identity.externalProductId,
    req.query.days
  );
  if (!result.success) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

// GET /api/products/compare?store=amazon&externalProductId=B0...
// Same-product prices across stores, from real stored snapshots only.
router.get('/compare', async (req, res) => {
  const identity = validateIdentity(req.query.store, req.query.externalProductId);
  if (!identity.ok) {
    return res.status(400).json({ success: false, error: identity.error });
  }

  try {
    const target = await snapshotService.getHistory(identity.store, identity.externalProductId, 90);
    const targetCurrent = target.success ? target.history.current : null;
    const targetName = (targetCurrent && targetCurrent.name) || '';
    const targetBrand = (targetCurrent && targetCurrent.brand) || '';
    const targetLatest = targetCurrent && targetCurrent.price !== null && targetCurrent.price !== undefined
      ? {
          store: identity.store,
          externalProductId: identity.externalProductId,
          name: targetCurrent.name,
          price: targetCurrent.price,
          mrp: targetCurrent.mrp ?? null,
          discountPercent: targetCurrent.discountPercent ?? null,
          url: targetCurrent.url,
          availability: targetCurrent.availability,
          capturedAt: targetCurrent.capturedAt
        }
      : null;

    const otherStore = identity.store === 'amazon' ? 'flipkart' : 'amazon';
    const candidates = await snapshotService.getLatestByStore(otherStore, 200);
    const matches = (candidates || [])
      .filter((snap) =>
        isSameProduct(
          { title: targetName, brand: targetBrand },
          { title: snap.productName, brand: snap.brand }
        )
      )
      .map((snap) => ({
        store: snap.store,
        externalProductId: snap.externalProductId,
        name: snap.productName,
        price: snap.price,
        mrp: snap.mrp ?? null,
        discountPercent: snap.discountPercent ?? null,
        url: snap.url || null,
        availability: snap.availability || null,
        capturedAt: snap.capturedAt
      }));

    const entries = [];
    if (targetLatest && targetLatest.price !== null && targetLatest.price !== undefined) {
      entries.push(targetLatest);
    }
    entries.push(...matches);

    if (entries.length === 0) {
      return res.json({
        success: true,
        comparison: {
          store: identity.store,
          externalProductId: identity.externalProductId,
          matched: false,
          entries: [],
          best: null,
          message: 'Not enough historical data to compare.'
        }
      });
    }

    if (entries.length === 1) {
      return res.json({
        success: true,
        comparison: {
          store: identity.store,
          externalProductId: identity.externalProductId,
          matched: false,
          entries,
          best: entries[0],
          message: 'Only one store has current data for this product.'
        }
      });
    }

    const sorted = [...entries].sort((a, b) => a.price - b.price);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return res.json({
      success: true,
      comparison: {
        store: identity.store,
        externalProductId: identity.externalProductId,
        matched: true,
        entries: sorted,
        best,
        priceDifference: worst.price - best.price,
        message: null
      }
    });
  } catch (error) {
    console.error('Compare failed:', error && error.message ? error.message : error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Could not compare prices.' }
    });
  }
});

module.exports = router;
// Exported for unit tests; the router itself remains the middleware.
module.exports.errorStatus = errorStatus;
module.exports.STATUS_BY_CODE = STATUS_BY_CODE;
