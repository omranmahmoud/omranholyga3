import Category from '../models/Category.js';
import Product from '../models/Product.js';

// Helper to resolve category image with fallbacks
const DEFAULT_CATEGORY_IMAGE = '/placeholder-image.jpg';
// Normalize image paths: if path contains uploads/, expose under /api/uploads, otherwise return as-is
function normalizeImagePath(img) {
  if (!img || typeof img !== 'string') return img;
  let s = img.trim().replace(/\\/g, '/').replace(/^\.?\/?public\//, '');
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes('uploads/')) {
    const last = s.split('uploads/').pop();
    return `/api/uploads/${String(last).replace(/^\/+/, '')}`;
  }
  if (s.startsWith('/uploads/')) return `/api${s}`;
  if (s.startsWith('/')) return s;
  return `/api/uploads/${s}`;
}
async function resolveCategoryImage(category) {
  // If category has an explicit image, use it
  if (category.image && category.image.trim() !== '') return category.image;

  // Otherwise, try to find a product in this category and use its first image
  try {
    const candidates = await Product.find({
      $or: [
        { category: category._id },
        { category: String(category._id) },
        // Ultra defensive: if some products stored category by slug or name as a string
        { category: String(category.slug || '') },
        { category: String(category.name || '') }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    for (const p of candidates) {
      const firstImage = (Array.isArray(p.images) ? p.images.find(Boolean) : undefined)
        || (Array.isArray(p.colors) ? (p.colors.find((c) => Array.isArray(c?.images) && c.images.length)?.images?.[0]) : undefined);
      if (firstImage) return firstImage;
    }
  } catch (e) {
    // ignore and fallback to default
  }

  // Fallback to default placeholder
  return DEFAULT_CATEGORY_IMAGE;
}

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort('order').lean();
    // Resolve images in parallel
    const withImages = await Promise.all(
      categories.map(async (cat) => {
        const resolved = normalizeImagePath(await resolveCategoryImage(cat));
        return {
          ...cat,
          image: (cat.image && String(cat.image).trim() !== '') ? cat.image : resolved,
          resolvedImage: resolved,
        };
      })
    );
    res.json(withImages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single category
export const getCategory = async (req, res) => {
  try {
  const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
  const resolvedImage = normalizeImagePath(await resolveCategoryImage(category));
  const image = (category.image && String(category.image).trim() !== '') ? category.image : resolvedImage;
  res.json({ ...category, image, resolvedImage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create category
export const createCategory = async (req, res) => {
  try {
    // Validate name
    if (!req.body.name || req.body.name.trim().length === 0) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    // Check for duplicate name
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }

    const category = new Category({
      ...req.body,
      name: req.body.name.trim() // Ensure name is trimmed
    });
    
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      if (error.keyPattern.slug) {
        res.status(400).json({ message: 'Category with this slug already exists' });
      } else if (error.keyPattern.name) {
        res.status(400).json({ message: 'Category with this name already exists' });
      } else {
        res.status(400).json({ message: 'Duplicate key error' });
      }
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    // Validate name if provided
    if (req.body.name && req.body.name.trim().length === 0) {
      return res.status(400).json({ message: 'Category name cannot be empty' });
    }

    // Check for duplicate name if name is being changed
    if (req.body.name) {
      const existingCategory = await Category.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') }
      });

      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this name already exists' });
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { ...req.body, name: req.body.name?.trim() },
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      if (error.keyPattern.slug) {
        res.status(400).json({ message: 'Category with this slug already exists' });
      } else if (error.keyPattern.name) {
        res.status(400).json({ message: 'Category with this name already exists' });
      } else {
        res.status(400).json({ message: 'Duplicate key error' });
      }
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reorder categories
export const reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body;
    await Promise.all(
      categories.map(({ id, order }) => 
        Category.findByIdAndUpdate(id, { order })
      )
    );
    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};