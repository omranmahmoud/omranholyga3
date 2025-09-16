import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories
} from '../controllers/categoryController.js';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategory);

// Admin routes
router.post('/', adminAuth, createCategory);
router.put('/reorder', adminAuth, reorderCategories);
// Use explicit RegExp objects to avoid path-to-regexp parse issues on newer versions
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
router.put('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return updateCategory(req, res, next);
});
router.delete('/:id', adminAuth, (req, res, next) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  return deleteCategory(req, res, next);
});

export default router;