// PriceWise - Price snapshot service.
// Persists REAL observations from successful live imports and serves
// 30-day history with statistics. Snapshots are never fabricated and
// never written for mock/failed imports.

const PriceSnapshot = require('../models/PriceSnapshot');
const { calculateDiscount, getBestOffer, summarizeSnapshots } = require('./discount-utils');

const SUPPORTED_STORES = ['amazon', 'flipkart'];
const MAX_HISTORY_DAYS = 90;
const DEFAULT_HISTORY_DAYS = 30;
const MAX_DATA_POINTS = 500;
// Skip a snapshot identical (price+MRP) to one captured very recently so
// repeated imports don't flood history, while still recording over time.
const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000;

function normalizeIdentity(store, externalProductId) {
  const cleanStore = typeof store === 'string' ? store.trim().toLowerCase() : '';
  const cleanId = typeof externalProductId === 'string' ? externalProductId.trim() : '';
  if (!SUPPORTED_STORES.includes(cleanStore) || !cleanId) {
    return null;
  }
  return { store: cleanStore, externalProductId: cleanId };
}

function clampDays(days) {
  const parsed = Number(days);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HISTORY_DAYS;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_HISTORY_DAYS);
}

class SnapshotService {
  constructor({ snapshotModel = PriceSnapshot } = {}) {
    this.snapshots = snapshotModel;
  }

  /**
   * Record a snapshot for a normalized product.
   * Only sourceType === 'live' products are stored. Returns the saved
   * document, {skipped:true} for recent duplicates, or {stored:false}.
   */
  async recordSnapshot(product) {
    if (!product || typeof product !== 'object' || product.sourceType !== 'live') {
      return { stored: false, reason: 'not-live' };
    }
    const identity = normalizeIdentity(product.source, product.externalId);
    if (!identity) {
      return { stored: false, reason: 'no-identity' };
    }

    const bestOffer = getBestOffer(product);
    if (!bestOffer) {
      return { stored: false, reason: 'no-price' };
    }

    // Fast skip when the real model has no live database connection
    // (tests, offline mode). Fake/injected models without a `.db`
    // handle proceed normally. Never buffers for seconds on a dead DB.
    const db = this.snapshots && this.snapshots.db;
    if (db && typeof db.readyState === 'number' && db.readyState !== 1) {
      return { stored: false, reason: 'db-offline' };
    }

    const discount = calculateDiscount(bestOffer.price, product.mrp);
    const record = {
      store: identity.store,
      externalProductId: identity.externalProductId,
      productName: typeof product.name === 'string' && product.name ? product.name.slice(0, 500) : 'Unknown Product',
      brand: typeof product.brand === 'string' ? product.brand.slice(0, 200) : '',
      price: Number(bestOffer.price),
      mrp: typeof product.mrp === 'number' && Number.isFinite(product.mrp) && product.mrp > 0 ? product.mrp : null,
      discountAmount: discount ? discount.discountAmount : null,
      discountPercent: discount ? discount.discountPercent : null,
      currency: bestOffer.currency || product.currency || 'INR',
      url: typeof product.url === 'string' ? product.url.slice(0, 2000) : '',
      image: typeof product.image === 'string' ? product.image.slice(0, 2000) : '',
      availability: typeof bestOffer.availability === 'string' ? bestOffer.availability.slice(0, 200) : 'Unknown',
      capturedAt: new Date()
    };

    try {
      const latest = await this.snapshots
        .findOne({ store: identity.store, externalProductId: identity.externalProductId })
        .sort({ capturedAt: -1 })
        .lean();
      if (
        latest &&
        latest.price === record.price &&
        (latest.mrp || null) === (record.mrp || null) &&
        latest.capturedAt &&
        Date.now() - new Date(latest.capturedAt).getTime() < DEDUP_WINDOW_MS
      ) {
        return { stored: false, skipped: true, reason: 'duplicate-recent' };
      }
      const saved = await this.snapshots.create(record);
      return { stored: true, snapshot: saved };
    } catch (error) {
      console.error('SnapshotService.recordSnapshot failed:', error && error.message ? error.message : error);
      return { stored: false, reason: 'db-error' };
    }
  }

  /**
   * Retrieve history + statistics for a product identity.
   */
  async getHistory(store, externalProductId, days = DEFAULT_HISTORY_DAYS) {
    const identity = normalizeIdentity(store, externalProductId);
    if (!identity) {
      return { success: false, error: { code: 'INVALID_IDENTITY', message: 'Unknown store or product identifier.' } };
    }
    const windowDays = clampDays(days);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    try {
      const [latest, windowDocs] = await Promise.all([
        this.snapshots
          .findOne({ store: identity.store, externalProductId: identity.externalProductId })
          .sort({ capturedAt: -1 })
          .lean(),
        this.snapshots
          .find({
            store: identity.store,
            externalProductId: identity.externalProductId,
            capturedAt: { $gte: since }
          })
          .sort({ capturedAt: 1 })
          .limit(MAX_DATA_POINTS)
          .lean()
      ]);

      const stats = summarizeSnapshots(windowDocs);
      return {
        success: true,
        history: {
          store: identity.store,
          externalProductId: identity.externalProductId,
          days: windowDays,
          dataAvailable: Boolean(stats),
          current: latest
            ? {
                price: latest.price,
                mrp: latest.mrp ?? null,
                discountPercent: latest.discountPercent ?? null,
                capturedAt: latest.capturedAt,
                name: latest.productName || null,
                brand: latest.brand || null,
                url: latest.url || null,
                availability: latest.availability || null
              }
            : null,
          lowestPrice: stats ? stats.lowestPrice : null,
          lowestPriceDate: stats ? stats.lowestPriceDate : null,
          highestPrice: stats ? stats.highestPrice : null,
          highestPriceDate: stats ? stats.highestPriceDate : null,
          averagePrice: stats ? stats.averagePrice : null,
          dataPointCount: stats ? stats.dataPoints : 0,
          dataPoints: stats ? stats.points : []
        }
      };
    } catch (error) {
      console.error('SnapshotService.getHistory failed:', error && error.message ? error.message : error);
      return { success: false, error: { code: 'SERVER_ERROR', message: 'Could not load price history.' } };
    }
  }

  /**
   * Latest snapshot per product for one store (for cross-store matching).
   * Returns at most `limit` entries, newest first.
   */
  async getLatestByStore(store, limit = 200) {
    const cleanStore = typeof store === 'string' ? store.trim().toLowerCase() : '';
    if (!SUPPORTED_STORES.includes(cleanStore)) {
      return [];
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    try {
      const rows = await this.snapshots.aggregate([
        { $match: { store: cleanStore } },
        { $sort: { capturedAt: -1 } },
        {
          $group: {
            _id: '$externalProductId',
            doc: { $first: '$$ROOT' }
          }
        },
        { $sort: { 'doc.capturedAt': -1 } },
        { $limit: safeLimit }
      ]);
      return (rows || []).map((row) => row.doc).filter(Boolean);
    } catch (error) {
      console.error('SnapshotService.getLatestByStore failed:', error && error.message ? error.message : error);
      return [];
    }
  }
}

module.exports = { SnapshotService, normalizeIdentity, clampDays, DEDUP_WINDOW_MS, MAX_HISTORY_DAYS };
