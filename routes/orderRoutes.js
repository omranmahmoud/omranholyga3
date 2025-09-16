import express from 'express';
import { auth, adminAuth, optionalAuth } from '../middleware/auth.js';
import {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getOrderById
} from '../controllers/orderController.js';

const router = express.Router();

// Public routes (guest checkout)
router.post('/', optionalAuth, (req, res, next) => {
  console.log('POST /orders route hit');
  next();
}, createOrder);

// Protected routes
router.get('/my-orders', auth, getUserOrders);

// Admin routes
router.get('/all', adminAuth, getAllOrders);
router.put('/:id/status', adminAuth, updateOrderStatus);
// Single order
router.get('/:id', optionalAuth, getOrderById);

export default router;