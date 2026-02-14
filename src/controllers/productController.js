const Product = require('../models/Product');

// Utility: ensure handmade price is 10–40% above ready-made
const validatePriceGap = (priceReady, priceHandmade) => {
  const min = +(priceReady * 1.1).toFixed(2);
  const max = +(priceReady * 1.4).toFixed(2);
  return priceHandmade >= min && priceHandmade <= max;
};

// ✅ CREATE PRODUCT (with multiple images)
exports.createProduct = async (req, res) => {
  console.log("BODY RECEIVED:", req.body);

  try {
    const { priceReady, priceHandmade, images } = req.body;

    // 1. Validation for price
    if (!priceReady) return res.status(400).json({ message: 'priceReady is required' });

    let handmade = priceHandmade;
    if (!handmade) handmade = +(priceReady * 1.3).toFixed(2);

    if (!validatePriceGap(priceReady, handmade)) {
      return res.status(400).json({ message: 'priceHandmade must be 10%–40% higher than priceReady' });
    }

    // 2. FIXED: Use images from req.body (URLs sent from Frontend)
    // Removed req.files check because Frontend handles the upload
    const finalImages = images || [];

    if (finalImages.length === 0) {
      return res.status(400).json({ message: "At least one product image is required" });
    }

    const productData = {
      ...req.body,
      priceHandmade: handmade,
      images: finalImages // Array of strings from Cloudinary
    };

    const newProduct = await Product.create(productData);

    res.status(201).json({ status: 'success', data: { product: newProduct } });

  } catch (err) {
    console.error("Mongoose Error:", err);
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// ✅ GET ALL PRODUCTS
exports.getAllProducts = async (req, res) => {
  const products = await Product.find({ active: true });
  res.status(200).json({ status: 'success', data: { products } });
};

// ✅ GET SINGLE PRODUCT
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.status(200).json({ status: 'success', data: { product } });

  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// ✅ UPDATE PRODUCT (supports replacing images)
exports.updateProduct = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.priceReady && updates.priceHandmade) {
      if (!validatePriceGap(updates.priceReady, updates.priceHandmade)) {
        return res.status(400).json({ message: 'priceHandmade must be 10%–40% higher than priceReady' });
      }
    }

    // ✅ If new images uploaded, replace gallery
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(file => file.path);
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.status(200).json({ status: 'success', data: { product } });

  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// ✅ DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.status(204).json({ status: 'success', data: null });

  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
