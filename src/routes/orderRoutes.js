// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// User routes - authenticated users
router.get('/all', authenticate, requireAdmin, orderController.getAllOrders);
router.post('/', authenticate, orderController.createOrder);
router.get('/', authenticate, orderController.getUserOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);

// Admin routes - order management
// Temporary route to make Dashboard work
// router.get('/all', async (req, res) => {
//   // Return empty list if table is empty or just to prevent crash
//   res.json({ success: true, orders: [] }); 
// });
router.patch('/:id/status', authenticate, requireAdmin, orderController.updateOrderStatus);

module.exports = router;
