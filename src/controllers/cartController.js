const { supabase } = require('../config/supabase');

// 1. SYNC CART
const syncCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { localCart } = req.body;

    if (!localCart || localCart.length === 0) {
      return res.status(200).json({ success: true, message: 'Nothing to sync' });
    }

    // 🛠️ FIX 1: Merge duplicates locally before sending to Supabase
    const itemMap = {};
    localCart.forEach(item => {
      const key = `${item.productId}_${item.variantId || 'none'}`;
      if (!itemMap[key]) {
        itemMap[key] = {
          user_id: userId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: 0
        };
      }
      itemMap[key].quantity += item.qty;
    });

    const itemsToUpsert = Object.values(itemMap);

    // Upsert the merged items
    const { error } = await supabase
      .from('cart_items')
      .upsert(itemsToUpsert, { onConflict: 'user_id, product_id, variant_id' });

    if (error) {
      console.error('Supabase Upsert Error:', error);
      throw error;
    }

    return res.status(200).json({ success: true, message: 'Cart Synced' });

  } catch (error) {
    console.error('Cart Sync Fatal Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. GET CART
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🛠️ FIX 2: Explicitly use the Foreign Key name we just created in SQL
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        product_id,
        variant_id,
        products:product_id ( title, images, price ),
        product_variants:cart_items_variant_id_fkey ( size, price, stock_quantity )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Get Cart Supabase Error:', error);
      throw error;
    }

    // Format it safely
    const formattedCart = cartItems.map(item => ({
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.products?.title || "Unknown Artifact",
      image: item.products?.images?.[0] || "",
      size: item.product_variants?.size || 'One Size',
      qty: item.quantity,
      price: item.product_variants?.price || item.products?.price,
      maxStock: item.product_variants?.stock_quantity || 10 
    }));

    res.status(200).json({ success: true, cart: formattedCart });

  } catch (error) {
    console.error('Get Cart Fatal Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. REMOVE ITEM
const removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantId } = req.body;

    let query = supabase.from('cart_items').delete().eq('user_id', userId).eq('product_id', productId);
    
    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else {
      query = query.is('variant_id', null);
    }

    const { error } = await query;
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { syncCart, getCart, removeItem };