const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// PUBLIC: Users can request orders
router.post('/request', orderController.requestOrder);

// PRIVATE: Only Admin can see the list of all order requests
router.get('/all', protect, restrictTo('admin'), orderController.getAllOrders);

// ADMIN: Update order status
router.patch('/:id/status', protect, restrictTo('admin'), orderController.updateOrderStatus);

module.exports = router;