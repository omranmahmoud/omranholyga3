import mongoose from 'mongoose';

const homepageSideBannerSchema = new mongoose.Schema({
  label: { type: String, required: true },
  image: { type: String, required: true },
  link: { type: String, default: '' },
  side: { type: String, enum: ['left', 'right'], required: true },
  position: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  // Label overlay appearance per item (optional)
  labelBgType: { type: String, enum: ['gradient', 'solid', 'none'], default: 'gradient' },
  labelBgColor: { type: String, default: '#000000' },
  labelBgOpacity: { type: Number, default: 60 }, // 0..100
  labelTextColor: { type: String, default: '#FFFFFF' }
}, { timestamps: true });

homepageSideBannerSchema.index({ side: 1, position: 1 });

const HomepageSideBanner = mongoose.model('HomepageSideBanner', homepageSideBannerSchema);
export default HomepageSideBanner;
