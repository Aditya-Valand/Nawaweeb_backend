const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require("../middleware/upload");

// PUBLIC: Everyone can see products (only active ones)
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// PRIVATE: Only Admin can add new "Anime Artifacts"
router.post(
  "/add",
  protect,
  restrictTo("admin"),
  upload.array("images", 6),
  productController.createProduct
);

// router.post('/add', protect, restrictTo('admin'), productController.createProduct);
// router.patch('/:id', protect, restrictTo('admin'), productController.updateProduct);
router.patch(
  "/:id",
  protect,
  restrictTo("admin"),
  upload.array("images", 6),
  productController.updateProduct
);
router.delete('/:id', protect, restrictTo('admin'), productController.deleteProduct);

module.exports = router;

// router.post('/add', protect, restrictTo('admin'), productController.createProduct);
// router.patch('/:id', protect, restrictTo('admin'), productController.updateProduct);
// router.delete('/:id', protect, restrictTo('admin'), productController.deleteProduct);