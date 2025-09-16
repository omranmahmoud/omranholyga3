import MobileBanner from '../models/MobileBanner.js';
import mongoose from 'mongoose';

export const getAllMobileBanners = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === '1' || req.query.active === 'true') {
      filter.isActive = true;
    }
    if (req.query.navigationCategory) {
      const id = req.query.navigationCategory;
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter.navigationCategory = id;
      } else if (id === 'null' || id === 'none') {
        filter.$or = [{ navigationCategory: { $exists: false } }, { navigationCategory: null }];
      }
    }
    const banners = await MobileBanner.find(filter)
      .populate('navigationCategory', 'name slug')
      .sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch banners', error: err.message });
  }
};

export const createMobileBanner = async (req, res) => {
  try {
  console.log('Create MobileBanner body:', req.body);
    const payload = { ...req.body };
    ['image','title','subtitle','cta','link'].forEach((k) => {
      if (typeof payload[k] === 'string') payload[k] = payload[k].trim();
    });
    if (payload.navigationCategory === '' || payload.navigationCategory === 'none') {
      delete payload.navigationCategory;
    }
    if (payload.navigationCategory && !mongoose.Types.ObjectId.isValid(payload.navigationCategory)) {
      return res.status(400).json({ message: 'Invalid navigationCategory id' });
    }
    const banner = new MobileBanner(payload);
    const savedBanner = await banner.save();
    const populated = await savedBanner.populate('navigationCategory', 'name slug');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating mobile banner:', err);
    res.status(400).json({ message: 'Failed to create banner', error: err.message });
  }
};

export const updateMobileBanner = async (req, res) => {
  try {
    const payload = { ...req.body };
    ['image','title','subtitle','cta','link'].forEach((k) => {
      if (typeof payload[k] === 'string') payload[k] = payload[k].trim();
    });
    if (payload.navigationCategory === '' || payload.navigationCategory === 'none') {
      payload.navigationCategory = null;
    }
    if (payload.navigationCategory && !mongoose.Types.ObjectId.isValid(payload.navigationCategory)) {
      return res.status(400).json({ message: 'Invalid navigationCategory id' });
    }
    const updated = await MobileBanner.findByIdAndUpdate(req.params.id, payload, { new: true })
      .populate('navigationCategory', 'name slug');
    if (!updated) return res.status(404).json({ message: 'Banner not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update banner', error: err.message });
  }
};

export const deleteMobileBanner = async (req, res) => {
  try {
    const deleted = await MobileBanner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Banner not found' });
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete banner', error: err.message });
  }
};
