import mongoose from 'mongoose';

const homepageBannerSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  image: { type: String, required: true },
  link: { type: String, default: '' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  // Optional per-slide label appearance
  labelBgType: { type: String, enum: ['gradient', 'solid', 'none'], default: 'gradient' },
  labelBgColor: { type: String, default: '#000000' },
  labelBgOpacity: { type: Number, default: 60 }, // 0..100
  labelTextColor: { type: String, default: '#FFFFFF' }
}, { timestamps: true });

// Optional CTA button fields
homepageBannerSchema.add({
  ctaEnabled: { type: Boolean, default: false },
  ctaText: { type: String, default: '' },
  ctaUrl: { type: String, default: '' },
  ctaBgColor: { type: String, default: '#111827' }, // gray-900
  ctaTextColor: { type: String, default: '#FFFFFF' },
  ctaStyle: { type: String, enum: ['solid', 'outline'], default: 'solid' },
  ctaRounded: { type: Boolean, default: true },
  ctaPosition: { type: String, enum: [
    'top-left','top-center','top-right',
    'middle-left','center','middle-right',
    'bottom-left','bottom-center','bottom-right'
  ], default: 'bottom-left' }
});

homepageBannerSchema.index({ order: 1 });

const HomepageBanner = mongoose.model('HomepageBanner', homepageBannerSchema);
export default HomepageBanner;
