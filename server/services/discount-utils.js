// PriceWise - Discount calculation utilities (price intelligence).
// Pure functions only: no database, no network, fully unit-testable.
// Never fabricates values: missing/invalid inputs yield null.

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Calculate discount from a current price and an MRP/list price.
 * Returns null unless both values are valid numbers and MRP > price.
 * @param {*} price - current price
 * @param {*} mrp - MRP / list price
 * @returns {{discountAmount:number, discountPercent:number}|null}
 */
function calculateDiscount(price, mrp) {
  const currentPrice = toFiniteNumber(price);
  const listPrice = toFiniteNumber(mrp);
  if (currentPrice === null || listPrice === null) {
    return null;
  }
  if (listPrice <= 0 || currentPrice < 0 || listPrice <= currentPrice) {
    return null;
  }
  const discountAmount = listPrice - currentPrice;
  const discountPercent = (discountAmount / listPrice) * 100;
  return { discountAmount, discountPercent };
}

/**
 * Pick the best (lowest valid price) offer from a normalized product.
 * @param {Object} product - normalized PriceWise product
 * @returns {Object|null} best offer or null
 */
function getBestOffer(product) {
  if (!product || !Array.isArray(product.offers) || product.offers.length === 0) {
    return null;
  }
  let best = null;
  for (const offer of product.offers) {
    const price = offer ? toFiniteNumber(offer.price) : null;
    if (price === null || price <= 0) {
      continue;
    }
    if (!best || price < toFiniteNumber(best.price)) {
      best = offer;
    }
  }
  return best;
}

/**
 * Summarize an ascending list of snapshots into price statistics.
 * Snapshots: [{price, capturedAt, ...}]. Only finite prices count.
 * @param {Array} snapshots - ascending by capturedAt
 * @returns {Object|null} stats or null when no valid price exists
 */
function summarizeSnapshots(snapshots) {
  const points = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => s && toFiniteNumber(s.price) !== null && toFiniteNumber(s.price) > 0)
    .map((s) => ({
      price: toFiniteNumber(s.price),
      mrp: toFiniteNumber(s.mrp),
      discountPercent: toFiniteNumber(s.discountPercent),
      capturedAt: s.capturedAt instanceof Date ? s.capturedAt : new Date(s.capturedAt)
    }))
    .filter((p) => !Number.isNaN(p.capturedAt.getTime()));

  if (points.length === 0) {
    return null;
  }

  let lowest = points[0];
  let highest = points[0];
  let sum = 0;
  for (const point of points) {
    sum += point.price;
    if (point.price < lowest.price) {
      lowest = point;
    }
    if (point.price > highest.price) {
      highest = point;
    }
  }

  return {
    dataPoints: points.length,
    lowestPrice: lowest.price,
    lowestPriceDate: lowest.capturedAt.toISOString(),
    highestPrice: highest.price,
    highestPriceDate: highest.capturedAt.toISOString(),
    averagePrice: sum / points.length,
    points: points.map((p) => ({
      price: p.price,
      mrp: p.mrp,
      discountPercent: p.discountPercent,
      capturedAt: p.capturedAt.toISOString()
    }))
  };
}

/**
 * Compare a current reading against the previous snapshot.
 * Returns null when either side lacks a valid price.
 */
function compareWithPrevious(current, previous) {
  const currentPrice = toFiniteNumber(current && current.price);
  const previousPrice = toFiniteNumber(previous && previous.price);
  if (currentPrice === null || previousPrice === null) {
    return null;
  }
  const currentDiscount = calculateDiscount(currentPrice, current && current.mrp);
  const previousDiscount = calculateDiscount(previousPrice, previous && previous.mrp);
  return {
    currentPrice,
    previousPrice,
    priceChange: currentPrice - previousPrice,
    currentDiscountPercent: currentDiscount ? currentDiscount.discountPercent : null,
    previousDiscountPercent: previousDiscount ? previousDiscount.discountPercent : null,
    discountChangePoints:
      currentDiscount && previousDiscount
        ? currentDiscount.discountPercent - previousDiscount.discountPercent
        : null
  };
}

module.exports = {
  toFiniteNumber,
  calculateDiscount,
  getBestOffer,
  summarizeSnapshots,
  compareWithPrevious
};
