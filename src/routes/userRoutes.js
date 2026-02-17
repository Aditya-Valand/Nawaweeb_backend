
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const wishlistController = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');

// Add these specific routes
router.post('/cart/sync', authenticate, cartController.syncCart);
router.get('/cart', authenticate, cartController.getCart);
router.post('/cart/remove', authenticate, cartController.removeItem);
router.post('/togglewish', authenticate, wishlistController.toggleWishlist);
router.get('/getwishlist', authenticate, wishlistController.getWishlist);


module.exports = router;