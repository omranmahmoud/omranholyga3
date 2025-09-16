import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  image: {
    type: String,
  required: true,
  trim: true
  },
  title: {
  type: String,
  required: false,
  trim: true
  },
  subtitle: {
  type: String,
  required: false,
  trim: true
  },
  cta: {
  type: String,
  required: false,
  trim: true
  },
  link: {
  type: String,
  required: false,
  trim: true
  },
  // Optional relation to a Navigation Category this banner belongs to
  navigationCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationCategory',
    index: true,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('MobileBanner', bannerSchema);
