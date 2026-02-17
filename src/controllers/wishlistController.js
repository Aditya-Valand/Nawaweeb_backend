const { supabase } = require('../config/db');

// Toggle Wishlist (Add if missing, Remove if exists)
const toggleWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    // Check if exists
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (existing) {
      // Remove
      await supabase.from('wishlists').delete().eq('id', existing.id);
      return res.json({ success: true, action: 'removed' });
    } else {
      // Add
      await supabase.from('wishlists').insert({ user_id: userId, product_id: productId });
      return res.json({ success: true, action: 'added' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        products (
          id,
          title,
          price,
          images,
          is_active
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true, wishlist: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { toggleWishlist, getWishlist };