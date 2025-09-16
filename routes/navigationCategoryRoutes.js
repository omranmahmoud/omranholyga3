import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import NavigationCategory from '../models/NavigationCategory.js';

const router = express.Router();

// Get all navigation categories
router.get('/', async (req, res) => {
  try {
    const categories = await NavigationCategory.find()
      .populate('category', 'name slug')
      .sort('order');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create navigation category (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
  const body = { ...req.body };
  // Accept empty string as null for category mapping
  if (body.category === '' || body.category === 'none') delete body.category;
  const category = new NavigationCategory(body);
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Category with this name or slug already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Update navigation category (admin only)
router.put('/reorder', adminAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    await Promise.all(
      categories.map(({ id, order }) => 
        NavigationCategory.findByIdAndUpdate(id, { order })
      )
    );
    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update navigation category (admin only)
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
router.put('/:id', adminAuth, async (req, res) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  try {
    const body = { ...req.body };
    if (body.category === '' || body.category === 'none') body.category = null;
    const category = await NavigationCategory.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    ).populate('category', 'name slug');
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
  res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Category with this name or slug already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Delete navigation category (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  if (!objectIdRegex.test(req.params.id)) return res.status(400).json({ message: 'Invalid id format' });
  try {
    const category = await NavigationCategory.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reorder route moved above and consolidated

export default router;