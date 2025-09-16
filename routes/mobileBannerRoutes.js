import express from 'express';
import {
  getAllMobileBanners,
  createMobileBanner,
  updateMobileBanner,
  deleteMobileBanner
} from '../controllers/mobileBannerController.js';
import NavigationCategory from '../models/NavigationCategory.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', getAllMobileBanners);
router.post('/', createMobileBanner);
router.put('/:id', updateMobileBanner);
router.delete('/:id', deleteMobileBanner);

// Extra: Get banners for a specific navigation category by id or slug
router.get('/by-category/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let category = null;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      category = await NavigationCategory.findById(idOrSlug);
    } else {
      category = await NavigationCategory.findOne({ slug: idOrSlug });
    }
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const banners = await (await import('../models/MobileBanner.js')).default
      .find({ navigationCategory: category._id, isActive: true })
      .populate('navigationCategory', 'name slug')
      .sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category banners', error: error.message });
  }
});

export default router;
