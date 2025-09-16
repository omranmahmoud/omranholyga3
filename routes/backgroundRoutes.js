import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
  getBackgrounds,
  getActiveBackground,
  createBackground,
  updateBackground,
  deleteBackground,
  reorderBackgrounds
} from '../controllers/backgroundController.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveBackground);

// Admin routes
router.get('/', adminAuth, getBackgrounds);
router.post('/', adminAuth, createBackground);
router.put('/reorder', adminAuth, reorderBackgrounds);
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
router.put('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return updateBackground(req, res, next);
});
router.delete('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return deleteBackground(req, res, next);
});

export default router;