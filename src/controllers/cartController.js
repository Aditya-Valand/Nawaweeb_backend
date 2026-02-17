const { supabase } = require('../config/db');

// 1. SYNC CART (Called immediately after Login)
// Merges localStorage items into the Database
const syncCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { localCart } = req.body; // Array from localStorage

    if (!localCart || localCart.length === 0) {
      return res.status(200).json({ success: true, message: 'Nothing to sync' });
    }

    // Prepare data for upsert
    const itemsToUpsert = localCart.map(item => ({
      user_id: userId,
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.qty
    }));

    // Upsert (Insert or Update if exists)
    const { error } = await supabase
      .from('cart_items')
      .upsert(itemsToUpsert, { onConflict: 'user_id, product_id, variant_id' });

    if (error) {
      console.error('Supabase Upsert Error:', error);
      throw error;
    }

    return res.status(200).json({ success: true, message: 'Cart Synced' });

  } catch (error) {
    console.error('Cart Sync Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. GET CART (Called when loading the app)
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch items + Product Details
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        product_id,
        variant_id,
        products:product_id ( title, images, price ),
        product_variants:variant_id ( size, price, stock_quantity )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Format it to match your frontend structure
    const formattedCart = cartItems
      .filter(item => item.products) // Filter out items where product relationship failed (e.g. deleted product)
      .map(item => ({
        productId: item.product_id,
        variantId: item.variant_id,
        title: item.products?.title || 'Unknown Artifact',
        image: item.products?.images?.[0] || null,
        size: item.product_variants?.size || 'One Size',
        qty: item.quantity,
        price: item.product_variants?.price || item.products?.price || 0,
        // Calculate max stock for UI limits
        maxStock: item.product_variants?.stock_quantity || 10
      }));

    res.status(200).json({ success: true, cart: formattedCart });

  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. REMOVE ITEM
const removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId } = req.body;

    // Build the query
    let query = supabase.from('cart_items').delete().eq('user_id', userId).eq('product_id', productId);

    // Handle variants carefully
    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else {
      query = query.is('variant_id', null);
    }

    const { error } = await query;
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("Remove Item Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { syncCart, getCart, removeItem };