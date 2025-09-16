import FlashSale from '../models/FlashSale.js';
import Product from '../models/Product.js';
import { StatusCodes } from 'http-status-codes';
import Order from '../models/Order.js';

// Helper: validate items payload structure & business rules
async function validateItemsPayload(rawItems = [], { allowDuplicates = false } = {}) {
  if (!Array.isArray(rawItems)) throw new Error('items must be an array');
  const productIds = new Set();
  const validated = [];
  for (const item of rawItems) {
    const { product, flashPrice, stockLimit, perUserLimit } = item || {};
    if (!product) throw new Error('Each item requires product');
    if (!allowDuplicates) {
      if (productIds.has(product.toString())) throw new Error('Duplicate product in items payload');
      productIds.add(product.toString());
    }
    const prodDoc = await Product.findById(product).select('price name');
    if (!prodDoc) throw new Error('Product not found: ' + product);
    if (flashPrice === undefined || flashPrice === null) throw new Error('flashPrice required for product ' + prodDoc.name);
    if (typeof flashPrice !== 'number' || flashPrice < 0) throw new Error('flashPrice must be >= 0 for product ' + prodDoc.name);
    if (flashPrice >= prodDoc.price) throw new Error(`flashPrice must be less than base price (${prodDoc.price}) for product ${prodDoc.name}`);
    if (stockLimit !== undefined && (typeof stockLimit !== 'number' || stockLimit < 0)) throw new Error('stockLimit must be >= 0');
    if (perUserLimit !== undefined && (typeof perUserLimit !== 'number' || perUserLimit < 1)) throw new Error('perUserLimit must be >= 1');
    validated.push({
      product: prodDoc._id,
      flashPrice,
      stockLimit: stockLimit !== undefined ? stockLimit : undefined,
      perUserLimit: perUserLimit !== undefined ? perUserLimit : undefined
    });
  }
  return validated;
}

// Create Flash Sale
export const createFlashSale = async (req, res) => {
  try {
    const { title, startDate, endDate, items } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'title, startDate and endDate are required' });
    }
    let validatedItems = [];
    if (items && items.length) {
      validatedItems = await validateItemsPayload(items);
    }
    const flashSale = await FlashSale.create({
      title,
      description: req.body.description,
      startDate,
      endDate,
      items: validatedItems
    });
    await flashSale.populate('items.product', 'name price images');
    res.status(StatusCodes.CREATED).json(flashSale);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
};

// Get all flash sales (optionally filter by status via query ?status=active|upcoming|expired)
export const getFlashSales = async (req, res) => {
  try {
    const { status } = req.query;
    const now = new Date();
    const filter = {};
    if (status === 'active') {
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
    } else if (status === 'upcoming') {
      filter.startDate = { $gt: now };
    } else if (status === 'expired') {
      filter.endDate = { $lt: now };
    }
    const sales = await FlashSale.find(filter)
      .sort({ startDate: 1 })
      .populate('items.product', 'name price images');
    res.json(sales);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// Get single flash sale
export const getFlashSale = async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id)
      .populate('items.product', 'name price images');
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    res.json(flashSale);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// Update flash sale
export const updateFlashSale = async (req, res) => {
  try {
    if (req.body.startDate && req.body.endDate && new Date(req.body.endDate) <= new Date(req.body.startDate)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'endDate must be greater than startDate' });
    }
    // If items provided, validate & replace items atomically; else only update main fields
    let update = { ...req.body };
    if (req.body.items) {
      const validatedItems = await validateItemsPayload(req.body.items);
      update.items = validatedItems;
    }
    const flashSale = await FlashSale.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).populate('items.product', 'name price images');
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    res.json(flashSale);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
};

// Delete flash sale
export const deleteFlashSale = async (req, res) => {
  try {
    const flashSale = await FlashSale.findByIdAndDelete(req.params.id);
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    res.json({ message: 'Flash sale deleted successfully' });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// Add single item to flash sale
export const addFlashSaleItem = async (req, res) => {
  try {
    const { id } = req.params; // flash sale id
    const flashSale = await FlashSale.findById(id);
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    if (flashSale.status === 'expired') return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Cannot modify expired sale' });
    const [validated] = await validateItemsPayload([req.body], { allowDuplicates: false });
    const exists = flashSale.items.some(i => i.product.toString() === validated.product.toString());
    if (exists) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Product already in sale' });
    // Ensure the product referenced has at least one image; if not try to copy from first color
    try {
      const prod = await Product.findById(validated.product).select('images colors');
      if (prod) {
        const current = Array.isArray(prod.images) ? prod.images.filter(Boolean) : [];
        if (current.length === 0 && Array.isArray(prod.colors) && prod.colors[0]?.images?.length) {
          const colorImgs = prod.colors[0].images.filter(Boolean);
          if (colorImgs.length) {
            prod.images = colorImgs.slice(0, 6);
            await prod.save();
          }
        }
      }
    } catch {/* non-fatal */}
    flashSale.items.push(validated);
    await flashSale.save();
    await flashSale.populate('items.product', 'name price images');
    res.status(StatusCodes.CREATED).json(flashSale);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
};

// Update flash sale item (price/limits)
export const updateFlashSaleItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const flashSale = await FlashSale.findById(id);
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    if (flashSale.status === 'expired') return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Cannot modify expired sale' });
    const item = flashSale.items.id(itemId);
    if (!item) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Item not found in sale' });
    if (req.body.product && req.body.product !== item.product.toString()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Changing product reference not allowed' });
    }
    // Validate updated fields using helper (simulate a single item validation)
    const mergedPayload = {
      product: item.product,
      flashPrice: req.body.flashPrice !== undefined ? req.body.flashPrice : item.flashPrice,
      stockLimit: req.body.stockLimit !== undefined ? req.body.stockLimit : item.stockLimit,
      perUserLimit: req.body.perUserLimit !== undefined ? req.body.perUserLimit : item.perUserLimit
    };
    const [validated] = await validateItemsPayload([mergedPayload], { allowDuplicates: true });
    item.flashPrice = validated.flashPrice;
    item.stockLimit = validated.stockLimit;
    item.perUserLimit = validated.perUserLimit;
    await flashSale.save();
    await flashSale.populate('items.product', 'name price images');
    res.json(flashSale);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
};

// Remove item from sale
export const removeFlashSaleItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const flashSale = await FlashSale.findById(id);
    if (!flashSale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });
    const item = flashSale.items.id(itemId);
    if (!item) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Item not found in sale' });
    item.deleteOne();
    await flashSale.save();
    await flashSale.populate('items.product', 'name price images');
    res.json(flashSale);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
  }
};

// Public: get currently active flash sales
export const getActiveFlashSales = async (req, res) => {
  try {
    const now = new Date();
    const active = await FlashSale.find({ startDate: { $lte: now }, endDate: { $gte: now } })
      .sort({ endDate: 1 })
      // include colors so client can fallback to first color images
      .populate('items.product', 'name price originalPrice images colors');

    // Inject fallback images from first color if main images missing (non-mutating conversion for safety)
    const serialized = active.map(sale => {
      const saleObj = sale.toObject();
      saleObj.items = saleObj.items.map(it => {
        if (it?.product) {
          const existing = Array.isArray(it.product.images) ? it.product.images.filter(Boolean) : [];
          if (existing.length === 0) {
            const colorImgs = it.product.colors && it.product.colors[0] && Array.isArray(it.product.colors[0].images)
              ? it.product.colors[0].images.filter(Boolean)
              : [];
            if (colorImgs.length) {
              it.product.images = colorImgs.slice(0, 6);
            }
          } else {
            // sanitize: trim and drop empties
            it.product.images = existing.map(s => typeof s === 'string' ? s.trim() : s).filter(Boolean).slice(0, 6);
          }
        }
        return it;
      });
      return saleObj;
    });

    res.json(serialized);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// Public: get upcoming flash sales (limit optional ?limit=5)
export const getUpcomingFlashSales = async (req, res) => {
  try {
    const now = new Date();
    const limit = parseInt(req.query.limit || '10', 10);
    const upcoming = await FlashSale.find({ startDate: { $gt: now } })
      .sort({ startDate: 1 })
      .limit(limit)
      .populate('items.product', 'name price images');
    res.json(upcoming);
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

// Admin: analytics for a flash sale (sold items, revenue, remaining stock)
export const getFlashSaleAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await FlashSale.findById(id).populate('items.product', 'name price images');
    if (!sale) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Flash sale not found' });

    // Aggregate orders referencing this flash sale
    const orderItems = await Order.aggregate([
      { $match: { 'items.flashSale': sale._id } },
      { $unwind: '$items' },
      { $match: { 'items.flashSale': sale._id } },
      { $group: {
          _id: '$items.product',
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          flashPrice: { $first: '$items.flashPrice' },
          basePrice: { $first: '$items.basePrice' }
        }
      }
    ]);

    const itemStatsMap = new Map(orderItems.map(i => [i._id.toString(), i]));
    const items = sale.items.map(it => {
      const stat = itemStatsMap.get(it.product._id.toString());
      const remaining = typeof it.stockLimit === 'number' ? Math.max(0, it.stockLimit - it.soldCount) : null;
      return {
        product: {
          _id: it.product._id,
          name: it.product.name
        },
        flashPrice: it.flashPrice,
        basePrice: stat?.basePrice || it.product.price,
        stockLimit: it.stockLimit ?? null,
        perUserLimit: it.perUserLimit ?? null,
        soldCount: it.soldCount,
        aggregatedQuantitySold: stat?.quantitySold || 0,
        aggregatedRevenue: stat?.revenue || 0,
        remaining
      };
    });

    const totalSoldUnits = items.reduce((sum, i) => sum + i.aggregatedQuantitySold, 0);
    const totalRevenue = items.reduce((sum, i) => sum + i.aggregatedRevenue, 0);

    res.json({
      _id: sale._id,
      title: sale.title,
      startDate: sale.startDate,
      endDate: sale.endDate,
      status: sale.status,
      metrics: {
        totalSoldUnits,
        totalRevenue,
        itemCount: sale.items.length
      },
      items
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
