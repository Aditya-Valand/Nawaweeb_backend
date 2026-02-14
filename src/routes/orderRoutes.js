// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// User routes - authenticated users
router.post('/', authenticate, orderController.createOrder);
router.get('/', authenticate, orderController.getUserOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);

// Admin routes - order management
router.get('/admin/all', authenticate, requireAdmin, orderController.getAllOrders);
router.patch('/:id/status', authenticate, requireAdmin, orderController.updateOrderStatus);

module.exports = router;
