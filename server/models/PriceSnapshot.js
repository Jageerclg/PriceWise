// PriceWise - Historical price snapshot model.
// One document per observed (store, external product, capture time).
// Snapshots are REAL observations collected at import time; the application
// never fabricates history. No user or credential data is stored here.

const mongoose = require('mongoose');

const priceSnapshotSchema = new mongoose.Schema(
  {
    // 'amazon' | 'flipkart' — matches normalized product.source.
    store: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ['amazon', 'flipkart'],
      index: true
    },
    // Stable retailer identifier: ASIN for Amazon, PID for Flipkart.
    externalProductId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    brand: {
      type: String,
      trim: true,
      default: ''
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    mrp: {
      type: Number,
      min: 0,
      default: null
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: null
    },
    discountPercent: {
      type: Number,
      min: 0,
      default: null
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR'
    },
    url: {
      type: String,
      trim: true,
      default: ''
    },
    image: {
      type: String,
      trim: true,
      default: ''
    },
    availability: {
      type: String,
      trim: true,
      default: 'Unknown'
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: false }
);

// Fast lookups for history windows and latest-per-product queries.
priceSnapshotSchema.index({ store: 1, externalProductId: 1, capturedAt: 1 });
priceSnapshotSchema.index({ store: 1, capturedAt: -1 });

module.exports =
  mongoose.models.PriceSnapshot || mongoose.model('PriceSnapshot', priceSnapshotSchema);
