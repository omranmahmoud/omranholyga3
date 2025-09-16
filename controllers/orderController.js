import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Recipient from '../models/Recipient.js';
import Inventory from '../models/Inventory.js';
import FlashSale from '../models/FlashSale.js';
import { inventoryService } from '../services/inventoryService.js';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { realTimeEventService } from '../services/realTimeEventService.js';

// Create order
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    console.log('createOrder called with body:', JSON.stringify(req.body, null, 2));
  const { items, shippingAddress, paymentMethod, customerInfo = {}, currency = 'USD', paymentStatus: bodyPaymentStatus, paymentReference } = req.body;

    // Validate required fields
    if (!items?.length) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // If user is authenticated, allow fallback to their profile email/placeholder mobile
    const resolvedEmail = customerInfo.email || req.user?.email;
    const resolvedMobile = customerInfo.mobile || req.user?.mobile || customerInfo.phone;
    if (!resolvedEmail || !resolvedMobile) {
      return res.status(400).json({ message: 'Customer email and mobile number are required' });
    }

    if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.country) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    // Validate currency
    if (!SUPPORTED_CURRENCIES[currency]) {
      return res.status(400).json({ message: 'Invalid currency' });
    }

    // Start transaction
    await session.startTransaction();

    // Calculate total and validate stock
    let totalAmount = 0;
    const orderItems = [];
    const exchangeRate = SUPPORTED_CURRENCIES[currency].exchangeRate;
    const stockUpdates = []; // Track stock updates for rollback

    // Pre-fetch active flash sales for involved products to minimize queries
    const now = new Date();
    const productIdsInOrder = [...new Set(items.map(i => i.product))];
    const activeFlashSales = await FlashSale.find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      'items.product': { $in: productIdsInOrder }
    }).select('items.product items.flashPrice items.stockLimit items.perUserLimit items.soldCount');

    function resolveFlashSaleForProduct(productId) {
      for (const sale of activeFlashSales) {
        const it = sale.items.find(i => i.product.toString() === productId.toString());
        if (it) return { sale, item: it };
      }
      return null;
    }

    // Track per-user purchase counts for enforcing perUserLimit (simple aggregate of this order only; for full history need additional query)
    // TODO: Extend to historical count if strict enforcement required.

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      }

      let sizeName = item.size;
      let sizeStockOk = true;
      let sizeIndex = -1;

      // If size is specified, check and decrement size stock
      if (sizeName) {
        let sizeObj = null;
        let foundInRoot = false;
        // Try flat sizes first
        if (Array.isArray(product.sizes) && product.sizes.length) {
          sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
          if (sizeIndex !== -1) { sizeObj = product.sizes[sizeIndex]; foundInRoot = true; }
        }
        // Fallback: search inside colors[].sizes
        if (!sizeObj && Array.isArray(product.colors) && product.colors.length) {
          for (const color of product.colors) {
            if (Array.isArray(color.sizes) && color.sizes.length) {
              const found = color.sizes.find(s => s.name === sizeName);
              if (found) { sizeObj = found; break; }
            }
          }
        }
        // If still not found, but there are no size arrays configured at all, fallback to main stock
        if (!sizeObj) {
          const hasAnySizeArrays = (Array.isArray(product.sizes) && product.sizes.length) || (Array.isArray(product.colors) && product.colors.some(c => Array.isArray(c.sizes) && c.sizes.length));
          if (!hasAnySizeArrays) {
            console.warn(`Size '${sizeName}' supplied but product ${product._id} has no sizes arrays; falling back to root stock.`);
            sizeName = undefined; // treat as non-sized product
          } else {
            await session.abortTransaction();
            return res.status(400).json({ message: `Size '${sizeName}' not found for product ${product.name}` });
          }
        }
        if (sizeObj) {
          if (typeof sizeObj.stock !== 'number' || sizeObj.stock < item.quantity) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Insufficient stock for ${product.name} (size: ${sizeName}). Available: ${sizeObj.stock ?? 0}, Requested: ${item.quantity}` });
          }
          // Decrement stock only for root sizes array (not mutating nested color paths for now)
          if (foundInRoot && sizeIndex !== -1 && Array.isArray(product.sizes)) {
            product.sizes[sizeIndex].stock = sizeObj.stock - item.quantity;
          }
        }
      } else {
        // No size specified, check main stock
        if (product.stock < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` });
        }
      }

      // Determine flash sale pricing if applicable
      let appliedFlashSale = null;
      let unitBasePrice = product.price; // base currency price
      let unitPrice = unitBasePrice; // may get overridden by flash sale

      const flashCtx = resolveFlashSaleForProduct(product._id);
      if (flashCtx) {
        const { sale, item: saleItem } = flashCtx;
        appliedFlashSale = { sale, saleItem };
        unitPrice = saleItem.flashPrice; // apply flash price

        // Enforce stockLimit if defined
        if (typeof saleItem.stockLimit === 'number') {
          const remaining = saleItem.stockLimit - saleItem.soldCount;
          if (remaining <= 0 || item.quantity > remaining) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Flash sale stock exceeded for product ${product.name}. Remaining: ${Math.max(0, remaining)}` });
          }
        }

        // NOTE: perUserLimit enforcement would require querying past orders for this user+flashSale.
        if (typeof saleItem.perUserLimit === 'number' && req.user?._id) {
          // Simple current-order-only check to avoid multi-query overhead for now.
          if (item.quantity > saleItem.perUserLimit) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Per-user limit (${saleItem.perUserLimit}) exceeded for product ${product.name}` });
          }
        }
      }

      // Convert price (unitPrice) to order currency
      const priceInOrderCurrency = unitPrice * exchangeRate;
      totalAmount += priceInOrderCurrency * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: priceInOrderCurrency,
        name: product.name,
        image: product.images[0],
        size: sizeName || undefined,
        flashSale: appliedFlashSale ? appliedFlashSale.sale._id : undefined,
        basePrice: unitBasePrice,
        flashPrice: appliedFlashSale ? unitPrice : undefined
      });

      // Track stock update for this product
      stockUpdates.push({
        productId: product._id,
        originalStock: product.stock,
        newStock: product.stock - item.quantity
      });

      // Update product stock within transaction (total stock is recalculated by pre-save hook)
      if (!sizeName) {
        product.stock -= item.quantity;
      }
      await product.save({ session });

      // Increment flash sale soldCount inside the same transaction after stock adjustments
      if (appliedFlashSale) {
        await FlashSale.updateOne(
          { _id: appliedFlashSale.sale._id, 'items.product': product._id },
          { $inc: { 'items.$.soldCount': item.quantity } },
          { session }
        );
      }
    }

    // Save or update recipient in Recipient collection
    const recipientQuery = {
      email: resolvedEmail,
      mobile: resolvedMobile
    };
    const recipientUpdate = {
      firstName: customerInfo.firstName || req.user?.name?.split(' ')[0] || 'Guest',
      lastName: customerInfo.lastName || req.user?.name?.split(' ').slice(1).join(' ') || 'User',
      email: resolvedEmail,
      mobile: resolvedMobile,
      secondaryMobile: customerInfo.secondaryMobile,
      address: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        country: shippingAddress.country
      }
    };
    await Recipient.findOneAndUpdate(recipientQuery, recipientUpdate, { upsert: true, new: true, session });

    // Create order with auto-generated order number
    // Derive payment status: allow explicit 'completed' only if provided (e.g., after gateway capture)
    let paymentStatus = 'pending';
    if (paymentMethod === 'cod') {
      paymentStatus = 'pending';
    } else if (bodyPaymentStatus === 'completed') {
      paymentStatus = 'completed';
    }

    const order = new Order({
      items: orderItems,
      totalAmount,
      currency,
      exchangeRate,
      shippingAddress,
      paymentMethod,
      paymentReference: paymentReference || '',
      customerInfo: {
        firstName: customerInfo.firstName || req.user?.name?.split(' ')[0] || 'Guest',
        lastName: customerInfo.lastName || req.user?.name?.split(' ').slice(1).join(' ') || 'User',
        email: resolvedEmail,
        mobile: resolvedMobile,
        secondaryMobile: customerInfo.secondaryMobile
      },
      status: 'pending',
      orderNumber: `ORD${Date.now()}`,
      paymentStatus
    });
    if (req.user?._id) {
      order.user = req.user._id;
    }

    let savedOrder;
    try {
      savedOrder = await order.save({ session });
    } catch (err) {
      // Handle duplicate orderNumber edge case: regenerate and retry once
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNumber) {
        order.orderNumber = `ORD${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        savedOrder = await order.save({ session });
      } else {
        await session.abortTransaction();
        throw err;
      }
    }

    // Commit the transaction
    await session.commitTransaction();

    // Emit real-time event for new order
    realTimeEventService.emitNewOrder(savedOrder);
    // Emit flash sale stock updates for any affected sales
    const impactedSales = [...new Set(orderItems.filter(i => i.flashSale).map(i => i.flashSale.toString()))];
    if (impactedSales.length) {
      const freshSales = await FlashSale.find({ _id: { $in: impactedSales } })
        .select('title startDate endDate items.product items.flashPrice items.stockLimit items.perUserLimit items.soldCount')
        .populate('items.product', 'name images');
      broadcastFlashSaleUpdate(freshSales);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        totalAmount: savedOrder.totalAmount,
        currency: savedOrder.currency,
  status: savedOrder.status,
  paymentStatus: savedOrder.paymentStatus,
  paymentReference: savedOrder.paymentReference
      }
    });
  } catch (error) {
    // Ensure transaction is aborted if still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error('Error creating order:', error);
    const message = error?.message || 'Failed to create order';
    res.status(500).json({
      message,
      error: message
    });
  } finally {
    // End the session
    await session.endSession();
  }
};

// Helper to broadcast flash sale updates (minimal payload)
function broadcastFlashSaleUpdate(flashSales) {
  try {
    realTimeEventService.emitSystemNotification({
      type: 'flash_sale_update',
      sales: flashSales.map(s => ({
        _id: s._id,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        items: s.items.map(it => ({
          product: {
            _id: it.product?._id || it.product,
            name: it.product?.name
          },
          flashPrice: it.flashPrice,
          stockLimit: it.stockLimit,
            perUserLimit: it.perUserLimit,
          soldCount: it.soldCount,
          remaining: typeof it.stockLimit === 'number' ? Math.max(0, it.stockLimit - it.soldCount) : null
        }))
      }))
    });
  } catch (err) {
    console.error('Failed to broadcast flash sale update', err);
  }
}

// Get user orders
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Get all orders (admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    // Find the order first to check previous status
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const prevStatus = order.status;

    // Update status
    order.status = status;
    await order.save();

    // Only auto-decrement inventory if status is first set to 'delivered' (or 'fulfilled')
    if ((status === 'delivered' || status === 'fulfilled') && prevStatus !== status) {
      for (const item of order.items) {
        // Find inventory record for product, size, color
        const inv = await Inventory.findOne({
          product: item.product,
          size: item.size || '',
          color: item.color || ''
        });
        if (inv) {
          const newQty = Math.max(0, inv.quantity - item.quantity);
          await inventoryService.updateInventory(inv._id, newQty, req.user?._id || null);
        }
      }
    }

    // Emit real-time event for order update
    realTimeEventService.emitOrderUpdate(order);

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// Get single order by ID (public for now via optional auth layer in route)
export const getOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }
    const order = await Order.findById(id)
      .populate('items.product', 'name images price')
      .lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Compute subtotal from stored per-line price (already in order currency)
    const subtotal = order.items.reduce((s, it) => s + (it.price * it.quantity), 0);
    const shipping = order.deliveryFee || 0;

    // Derive flash savings (basePrice - flashPrice) * exchangeRate when flashPrice present
    const flashSavings = order.items.reduce((s, it) => {
      if (typeof it.basePrice === 'number' && typeof it.flashPrice === 'number' && it.basePrice > it.flashPrice) {
        return s + (it.basePrice - it.flashPrice) * it.quantity * (order.exchangeRate || 1);
      }
      return s;
    }, 0);

    // promotions represented as negative value (align with mobile app expectations)
    const promotions = flashSavings ? -flashSavings : 0;
    const total = subtotal + shipping + promotions; // promotions negative subtracts savings

    return res.json({
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        currency: order.currency,
        shippingAddress: order.shippingAddress,
        items: order.items.map(it => ({
          product: it.product?._id || it.product,
            quantity: it.quantity,
            price: it.price,
            size: it.size,
            basePrice: it.basePrice,
            flashPrice: it.flashPrice,
            name: it.product?.name || it.name,
            image: it.product?.images?.[0] || it.image
        })),
        totals: {
          subtotal,
          shipping,
          promotions,
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching order by id:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

// Request delivery assignment for user's own order
export const requestDeliveryAssignment = async (req, res) => {
  return res.status(400).json({ 
    message: 'Delivery company assignment is no longer available' 
  });
};