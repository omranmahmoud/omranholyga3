import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
  getSliders, createSlider, updateSlider, deleteSlider, reorderSliders,
  getSideBanners, createSideBanner, updateSideBanner, deleteSideBanner, reorderSideBanners
} from '../controllers/homepageController.js';

const router = express.Router();

// Sliders
router.get('/sliders', adminAuth, getSliders);
router.post('/sliders', adminAuth, createSlider);
router.put('/sliders/:id', adminAuth, updateSlider);
router.delete('/sliders/:id', adminAuth, deleteSlider);
router.put('/sliders/reorder', adminAuth, reorderSliders);

// Side banners
router.get('/side-banners', adminAuth, getSideBanners);
router.post('/side-banners', adminAuth, createSideBanner);
router.put('/side-banners/:id', adminAuth, updateSideBanner);
router.delete('/side-banners/:id', adminAuth, deleteSideBanner);
router.put('/side-banners/reorder', adminAuth, reorderSideBanners);

export default router;
