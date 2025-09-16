import mongoose from 'mongoose';

const heroSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: false
  },
  video: {
    type: String,
    required: false
  },
  primaryButtonText: {
    type: String,
    default: 'Shop Collection'
  },
  secondaryButtonText: {
    type: String,
    default: 'Explore Lookbook'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Custom validation: at least one of image or video is required
heroSchema.pre('validate', function(next) {
  if (!this.image && !this.video) {
    this.invalidate('image', 'Either image or video is required.');
    this.invalidate('video', 'Either image or video is required.');
  }
  next();
});

export default mongoose.model('Hero', heroSchema);