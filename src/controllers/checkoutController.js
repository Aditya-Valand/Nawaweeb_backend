const crypto = require('crypto');
const Razorpay = require('razorpay');
const { supabase } = require('../config/db');

// Initialize Razorpay instance (lazy initialization to avoid errors if keys not set)
let razorpay = null;

const initializeRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required');
    }
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

// In-memory store for pending Razorpay orders (razorpay_order_id -> user_id mapping)
// This is used by the webhook to identify which user a payment belongs to
const pendingRazorpayOrders = new Map();

const storePendingOrder = (razorpayOrderId, userId) => {
  pendingRazorpayOrders.set(razorpayOrderId, {
    userId,
    timestamp: Date.now(),
  });

  // Auto-cleanup after 20 minutes (payment window typically closes within this time)
  setTimeout(() => {
    pendingRazorpayOrders.delete(razorpayOrderId);
  }, 20 * 60 * 1000);
};

const getPendingOrder = (razorpayOrderId) => {
  return pendingRazorpayOrders.get(razorpayOrderId);
};

const clearPendingOrder = (razorpayOrderId) => {
  pendingRazorpayOrders.delete(razorpayOrderId);
};

/**
 * POST /api/checkout/create-razorpay-order
 * Creates a Razorpay order without inserting into the database yet.
 * Validates cart and stock availability first.
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const razorpayInstance = initializeRazorpay();
    const userId = req.user.id;

    // Step 1: Fetch user's cart items with product and variant details
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(
        `
        id,
        quantity,
        product_id,
        variant_id,
        product_variants(
          id,
          price,
          stock_quantity
        ),
        products(
          id,
          price
        )
      `
      )
      .eq('user_id', userId);

    if (cartError) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching cart items',
        error: cartError.message,
      });
    }

    // Step 2: Check if cart is empty
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty. Please add items before checkout.',
      });
    }

    // Step 3: Calculate total amount and validate stock
    let totalAmountInRupees = 0;
    const cartWithPrices = [];

    for (const item of cartItems) {
      const variantPrice = item.product_variants?.price;
      const productPrice = item.products?.price;
      const itemPrice = variantPrice !== null ? variantPrice : productPrice;

      if (!itemPrice) {
        return res.status(400).json({
          success: false,
          message: `Product pricing error for item ${item.product_id}`,
        });
      }

      // Validate stock availability
      const availableStock = item.product_variants?.stock_quantity || 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${item.product_id}. Available: ${availableStock}, Requested: ${item.quantity}`,
        });
      }

      const itemTotal = itemPrice * item.quantity;
      totalAmountInRupees += itemTotal;

      cartWithPrices.push({
        ...item,
        price_at_purchase: itemPrice,
      });
    }

    // Convert to paise (1 rupee = 100 paise)
    const totalAmountInPaise = Math.round(totalAmountInRupees * 100);

    // Step 4: Create Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: totalAmountInPaise,
      currency: 'INR',
      receipt: `order_${Date.now().toString(36)}`, // Short receipt format (under 40 chars)
    });

    // Store the mapping for webhook processing (expires in 20 minutes)
    storePendingOrder(razorpayOrder.id, userId);

    // Step 5: Return Razorpay order details to frontend
    return res.status(200).json({
      success: true,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating payment order',
      error: error.message,
    });
  }
};

/**
 * POST /api/checkout/verify-razorpay
 * Verifies the payment signature and fulfills the order in the database.
 */
const verifyRazorpaySignature = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      shipping_address,
    } = req.body;

    // Step 1: Validate request parameters
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment parameters',
      });
    }

    if (!shipping_address) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required',
      });
    }

    // Step 2: Validate shipping address fields
    const requiredFields = ['street', 'city', 'pincode', 'phone'];
    const missingFields = requiredFields.filter((field) => !shipping_address[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Shipping address missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Step 3: Verify Razorpay signature using HMAC SHA256
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const calculatedSignature = shasum.digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (
      !crypto.timingSafeEqual(
        Buffer.from(calculatedSignature),
        Buffer.from(razorpay_signature)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Step 4: Fetch user's cart items for order creation
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(
        `
        id,
        quantity,
        variant_id,
        product_id,
        product_variants(
          id,
          price,
          stock_quantity
        ),
        products(
          id,
          price
        )
      `
      )
      .eq('user_id', userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty or error fetching cart items',
      });
    }

    // Step 5: Recalculate total amount (security: prevent race conditions)
    let totalAmountInRupees = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      const variantPrice = item.product_variants?.price;
      const productPrice = item.products?.price;
      const priceAtPurchase = variantPrice !== null ? variantPrice : productPrice;

      if (!priceAtPurchase) {
        return res.status(400).json({
          success: false,
          message: 'Product pricing error during order creation',
        });
      }

      // Re-validate stock to prevent race conditions
      const availableStock = item.product_variants?.stock_quantity || 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock unavailable for product ${item.product_id}. Please try again.`,
        });
      }

      totalAmountInRupees += priceAtPurchase * item.quantity;

      orderItemsData.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase,
      });
    }

    // Step 6: Insert order into database
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_amount: totalAmountInRupees,
        status: 'pending',
        shipping_address: shipping_address,
        payment_method: 'razorpay',
        payment_status: 'paid',
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
      })
      .select();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return res.status(500).json({
        success: false,
        message: 'Error creating order in database',
        error: orderError.message,
      });
    }

    const orderId = newOrder[0].id;

    // Step 7: Insert order items
    const orderItemsWithOrderId = orderItemsData.map((item) => ({
      ...item,
      order_id: orderId,
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (orderItemsError) {
      console.error('Error inserting order items:', orderItemsError);
      // Revert order creation
      await supabase.from('orders').delete().eq('id', orderId);
      return res.status(500).json({
        success: false,
        message: 'Error creating order items. Order reverted.',
        error: orderItemsError.message,
      });
    }

    // Step 8: Decrement stock for each variant
    for (const item of cartItems) {
      const { error: stockError } = await supabase
        .from('product_variants')
        .update({
          stock_quantity: item.product_variants.stock_quantity - item.quantity,
        })
        .eq('id', item.variant_id);

      if (stockError) {
        console.error('Error updating stock:', stockError);
        // Revert order creation
        await supabase.from('order_items').delete().eq('order_id', orderId);
        await supabase.from('orders').delete().eq('id', orderId);
        return res.status(500).json({
          success: false,
          message: 'Error updating stock. Order reverted.',
          error: stockError.message,
        });
      }
    }

    // Step 9: Clear user's cart
    const { error: cartClearError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (cartClearError) {
      console.error('Error clearing cart:', cartClearError);
      // Note: Order is already created, cart clearing is not critical
      // Log but don't fail the entire transaction
    }

    // Step 10: Return success response
    clearPendingOrder(razorpay_order_id);
    return res.status(201).json({
      success: true,
      message: 'Payment verified and order created successfully',
      order_id: orderId,
      razorpay_order_id: razorpay_order_id,
      razorpay_payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Error verifying Razorpay signature:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message,
    });
  }
};

/**
 * POST /api/checkout/webhook
 * Handles asynchronous Razorpay webhook notifications.
 * Verifies webhook signature and fulfills order if payment succeeded.
 */
const handleWebhookNotification = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured',
      });
    }

    // Step 1: Verify webhook signature
    const razorpaySignature = req.headers['x-razorpay-signature'];
    if (!razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Webhook signature missing',
      });
    }

    const requestBody = JSON.stringify(req.body);
    const shasum = crypto.createHmac('sha256', webhookSecret);
    shasum.update(requestBody);
    const calculatedSignature = shasum.digest('hex');

    if (calculatedSignature !== razorpaySignature) {
      console.warn('Invalid webhook signature received');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    // Step 2: Extract webhook event data
    const event = req.body.event;
    const eventData = req.body.payload?.payment?.entity;

    if (
      event !== 'payment.authorized' &&
      event !== 'payment.captured'
    ) {
      // Not a payment success event, acknowledge and return
      return res.status(200).json({
        success: true,
        message: `Event ${event} acknowledged`,
      });
    }

    if (!eventData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload structure',
      });
    }

    const razorpayOrderId = eventData.order_id;
    const razorpayPaymentId = eventData.id;

    // Step 3: Check if order already exists (idempotency check)
    const { data: existingOrder, error: checkError } = await supabase
  .from('orders')
  .select('id')
  .eq('razorpay_order_id', razorpay_order_id)
  .single();

if (existingOrder) {
  // The webhook beat us to it! Just tell the frontend it was successful.
  return res.status(200).json({ 
    success: true, 
    message: "Payment verified (processed via webhook)",
    order_id: existingOrder.id 
  });
}

    // Step 4: Get user ID from pending orders store
    const pendingOrder = getPendingOrder(razorpayOrderId);
    if (!pendingOrder) {
      console.error('Cannot find user for Razorpay order ID:', razorpayOrderId);
      return res.status(200).json({
        success: true,
        message: 'Webhook acknowledged, but order mapping not found (user may have verified via /verify-razorpay)',
      });
    }

    const userId = pendingOrder.userId;

    // Step 5: Fetch user's cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(
        `
        id,
        quantity,
        variant_id,
        product_id,
        product_variants(
          id,
          price,
          stock_quantity
        ),
        products(
          id,
          price
        )
      `
      )
      .eq('user_id', userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      console.error('Cart error or empty cart in webhook:', userId);
      return res.status(200).json({
        success: true,
        message: 'Webhook acknowledged, but cart is empty',
      });
    }

    // Step 6: Recalculate total amount and prepare order data
    let totalAmountInRupees = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      const variantPrice = item.product_variants?.price;
      const productPrice = item.products?.price;
      const priceAtPurchase = variantPrice !== null ? variantPrice : productPrice;

      if (!priceAtPurchase) {
        return res.status(500).json({
          success: false,
          message: 'Product pricing error in webhook processing',
        });
      }

      totalAmountInRupees += priceAtPurchase * item.quantity;

      orderItemsData.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase,
      });
    }

    // Step 7: Create order (shipping_address not available in webhook, use placeholder)
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_amount: totalAmountInRupees,
        status: 'pending',
        shipping_address: { note: 'Address to be updated by user or from webhook notes' },
        payment_method: 'razorpay',
        payment_status: 'paid',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      })
      .select();

    if (orderError) {
      console.error('Error creating order in webhook:', orderError);
      return res.status(200).json({
        success: true,
        message: 'Webhook acknowledged, database error logged',
      });
    }

    const orderId = newOrder[0].id;

    // Step 8: Insert order items
    const orderItemsWithOrderId = orderItemsData.map((item) => ({
      ...item,
      order_id: orderId,
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (orderItemsError) {
      console.error('Error inserting order items in webhook:', orderItemsError);
      await supabase.from('orders').delete().eq('id', orderId);
      return res.status(200).json({
        success: true,
        message: 'Webhook acknowledged, order items error logged',
      });
    }

    // Step 9: Decrement stock for each variant
    for (const item of cartItems) {
      const { error: stockError } = await supabase
        .from('product_variants')
        .update({
          stock_quantity: item.product_variants.stock_quantity - item.quantity,
        })
        .eq('id', item.variant_id);

      if (stockError) {
        console.error('Error updating stock in webhook:', stockError);
        // Log but don't fail webhook acknowledgement
      }
    }

    // Step 10: Clear cart
    const { error: cartClearError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (cartClearError) {
      console.error('Error clearing cart in webhook:', cartClearError);
    }

    console.log(`Webhook: Order ${orderId} created for payment ${razorpayPaymentId}`);
    clearPendingOrder(razorpayOrderId);

    // Always return 200 to acknowledge webhook receipt
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      order_id: orderId,
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    // Always return 200 to prevent Razorpay from retrying
    return res.status(200).json({
      success: true,
      message: 'Webhook received and logged',
    });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
  handleWebhookNotification,
};
