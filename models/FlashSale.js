import mongoose from 'mongoose';

// Flash Sale Schema
// Represents a time-bound promotional campaign.
// Status is derived dynamically via a virtual (upcoming | active | expired).
const flashSaleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    maxlength: 2000
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  // Products included in this flash sale with specific pricing / limits
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    // Special flash sale price (must be >=0; deeper validation vs product price can be enforced in controller later)
    flashPrice: {
      type: Number,
      required: true,
      min: 0
    },
    // Optional total stock allocation reserved for this sale (<= actual available stock when enforced)
    stockLimit: {
      type: Number,
      min: 0
    },
    // Optional per-customer purchase cap during this sale
    perUserLimit: {
      type: Number,
      min: 1
    },
    // Tracked units sold through this flash sale (increment at order application time)
    soldCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

flashSaleSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    return next(new Error('endDate must be greater than startDate'));
  }
  next();
});

// Computed status (no persistence needed unless for analytics queries later)
flashSaleSchema.virtual('status').get(function() {
  const now = new Date();
  if (now < this.startDate) return 'upcoming';
  if (now > this.endDate) return 'expired';
  return 'active';
});

// Helpful compound index for time range queries
flashSaleSchema.index({ startDate: 1, endDate: 1 });
// Fast lookup for product presence inside active sale queries
flashSaleSchema.index({ 'items.product': 1 });

export default mongoose.model('FlashSale', flashSaleSchema);
