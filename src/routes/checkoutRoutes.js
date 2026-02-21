const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
  handleWebhookNotification,
} = require('../controllers/checkoutController');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/checkout/create-razorpay-order
 * Generates a Razorpay order before payment
 * Requires: Authentication
 * Returns: razorpay_order_id, amount, currency
 */
router.post('/create-razorpay-order', authenticate, createRazorpayOrder);

/**
 * POST /api/checkout/verify-razorpay
 * Verifies payment signature and creates the order in database
 * Requires: Authentication, razorpay_order_id, razorpay_payment_id, razorpay_signature, shipping_address
 * Returns: success status and order_id
 */
router.post('/verify-razorpay', authenticate, verifyRazorpaySignature);

/**
 * POST /api/checkout/webhook
 * Handles Razorpay webhook notifications asynchronously
 * Requires: Valid X-Razorpay-Signature header
 * Does NOT require: Authentication
 * Returns: 200 OK (always, to prevent retry)
 */
router.post('/webhook', handleWebhookNotification);

module.exports = router;
