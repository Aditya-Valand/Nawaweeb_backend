// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes - anyone can view products
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin routes - product management
router.post('/', authenticate, requireAdmin, productController.createProduct);
router.patch('/:id', authenticate, requireAdmin, productController.updateProduct);
router.delete('/:id', authenticate, requireAdmin, productController.deleteProduct);

// Admin routes - variant management
router.post('/:productId/variants', authenticate, requireAdmin, productController.addVariant);
router.patch('/variants/:variantId/stock', authenticate, requireAdmin, productController.updateVariantStock);

module.exports = router;
