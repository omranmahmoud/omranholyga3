import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
	createFlashSale,
	getFlashSales,
	getFlashSale,
	updateFlashSale,
	deleteFlashSale,
	getActiveFlashSales,
	getUpcomingFlashSales,
	addFlashSaleItem,
	updateFlashSaleItem,
	removeFlashSaleItem
} from '../controllers/flashSaleController.js';

const router = express.Router();

// Public endpoints (must come before dynamic :id route to avoid conflicts)
router.get('/public/active/list', getActiveFlashSales);
router.get('/public/upcoming/list', getUpcomingFlashSales);

// Admin CRUD
router.post('/', adminAuth, createFlashSale);
router.get('/', adminAuth, getFlashSales); // optional ?status=
router.get('/:id', adminAuth, getFlashSale);
router.put('/:id', adminAuth, updateFlashSale);
router.delete('/:id', adminAuth, deleteFlashSale);

// Admin item management
router.post('/:id/items', adminAuth, addFlashSaleItem);
router.put('/:id/items/:itemId', adminAuth, updateFlashSaleItem);
router.delete('/:id/items/:itemId', adminAuth, removeFlashSaleItem);

// Analytics
import { getFlashSaleAnalytics } from '../controllers/flashSaleController.js';
router.get('/:id/analytics', adminAuth, getFlashSaleAnalytics);

export default router;

