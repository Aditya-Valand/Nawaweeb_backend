// src/controllers/orderController.js
const { supabase } = require('../config/db');

/**
 * Create new order with transactional integrity
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, shipping_address } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items are required'
      });
    }

    if (!shipping_address || !shipping_address.address || !shipping_address.city) {
      return res.status(400).json({
        success: false,
        message: 'Valid shipping address is required'
      });
    }

    // Step 1: Validate all variants exist and have sufficient stock
    const variantIds = items.map(item => item.variant_id);
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id, stock_quantity, price_override, product_id, products(price, title)')
      .in('id', variantIds);

    if (variantError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch product variants'
      });
    }

    if (variants.length !== variantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more variants not found'
      });
    }

    // Step 2: Build order items and validate stock
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const variant = variants.find(v => v.id === item.variant_id);

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variant ${item.variant_id} not found`
        });
      }

      // Check stock availability
      if (variant.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${variant.products.title}. Available: ${variant.stock_quantity}, Requested: ${item.quantity}`
        });
      }

      // Calculate price (use price_override if available, else product price)
      const priceAtPurchase = variant.price_override || variant.products.price;
      const itemTotal = priceAtPurchase * item.quantity;

      orderItems.push({
        variant_id: variant.id,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase
      });

      totalAmount += itemTotal;
    }

    // Step 3: Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending',
        shipping_address
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order'
      });
    }

    // Step 4: Insert order items
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId)
      .select();

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Rollback: Delete the order
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order items'
      });
    }

    // Step 5: Decrement stock for each variant
    for (const item of items) {
      const variant = variants.find(v => v.id === item.variant_id);

      const { error: stockError } = await supabase
        .from('product_variants')
        .update({
          stock_quantity: variant.stock_quantity - item.quantity
        })
        .eq('id', item.variant_id)
        .gte('stock_quantity', item.quantity);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // Continue with order creation even if stock update fails
      }
    }

    // Step 6: Fetch complete order with items
    const { data: completeOrder } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product_variants (
            size,
            products (
              title,
              images
            )
          )
        )
      `)
      .eq('id', order.id)
      .single();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order: completeOrder || order }
    });

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during order creation'
    });
  }
};

/**
 * Get user's orders
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          product_variants (
            size,
            products (
              title,
              images
            )
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: { orders }
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get single order by ID
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = supabase
      .from('orders')
      .select(`
        *,
        profiles!orders_user_id_fkey (
          full_name,
          email
        ),
        order_items (
          *,
          product_variants (
            size,
            products (
              title,
              images
            )
          )
        )
      `)
      .eq('id', id);

    // Non-admin users can only view their own orders
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }

    const { data: order, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: { order }
    });

  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all orders (Admin only)
 */
const getAllOrders = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { status, payment_status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        profiles!orders_user_id_fkey (
          full_name,
          email
        ),
        order_items (
          quantity,
          price_at_purchase
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      count,
      data: { orders }
    });

  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update order status (Admin only)
 */
const updateOrderStatus = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { id } = req.params;
    const { status, payment_status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

    const updates = {};

    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      updates.status = status;
    }

    if (payment_status) {
      if (!validPaymentStatuses.includes(payment_status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`
        });
      }
      updates.payment_status = payment_status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Cancel order (User can cancel their own pending orders)
 */
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Fetch order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_items(variant_id, quantity)')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check ownership
    if (!isAdmin && order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only pending orders can be cancelled
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending orders can be cancelled'
      });
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel order'
      });
    }

    // Restore stock
    for (const item of order.order_items) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', item.variant_id)
        .single();

      if (variant) {
        await supabase
          .from('product_variants')
          .update({ stock_quantity: variant.stock_quantity + item.quantity })
          .eq('id', item.variant_id);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder
};
