import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
  getAnnouncements,
  getActiveAnnouncements,
  getActiveMobileAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  reorderAnnouncements
} from '../controllers/announcementController.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveAnnouncements); // optional ?platform=mobile
router.get('/mobile-active', getActiveMobileAnnouncements);

// Admin routes
router.get('/', adminAuth, getAnnouncements);
router.post('/', adminAuth, createAnnouncement);
router.put('/reorder', adminAuth, reorderAnnouncements);
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
router.put('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return updateAnnouncement(req, res, next);
});
router.delete('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return deleteAnnouncement(req, res, next);
});

export default router;