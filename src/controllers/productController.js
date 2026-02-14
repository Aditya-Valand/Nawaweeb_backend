// src/controllers/productController.js
const { supabase } = require('../config/db');

/**
 * Get all products with variants
 * Supports filtering by active status
 */
const getAllProducts = async (req, res) => {
  try {
    const { active, search } = req.query;

    let query = supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          size,
          stock_quantity,
          price_override
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by active status
    if (active !== undefined) {
      const isActive = active === 'true';
      query = query.eq('is_active', isActive);
    }

    // Search by title
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Get products error:', error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Calculate total stock per product
    const productsWithStock = products.map(product => ({
      ...product,
      total_stock: product.product_variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
    }));

    return res.status(200).json({
      success: true,
      count: products.length,
      data: { products: productsWithStock }
    });

  } catch (error) {
    console.error('Get all products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get single product by ID or slug
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          size,
          stock_quantity,
          price_override
        )
      `);

    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data: product, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: { product }
    });

  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create new product with variants
 * Admin only
 */
const createProduct = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { title, slug, price, images, description, is_active, variants } = req.body;

    // Validate required fields
    if (!title || !slug || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, slug, and price are required'
      });
    }

    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        title,
        slug,
        price: Math.round(price), // Ensure integer (cents)
        images: images || [],
        description: description || '',
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (productError) {
      if (productError.code === '23505') { // Duplicate slug
        return res.status(400).json({
          success: false,
          message: 'Product with this slug already exists'
        });
      }
      return res.status(400).json({
        success: false,
        message: productError.message
      });
    }

    // Insert variants if provided
    let createdVariants = [];
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantsToInsert = variants.map(v => ({
        product_id: product.id,
        size: v.size,
        stock_quantity: v.stock_quantity || 0,
        price_override: v.price_override ? Math.round(v.price_override) : null
      }));

      const { data: variantData, error: variantError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert)
        .select();

      if (variantError) {
        console.error('Variant creation error:', variantError);
        // Product created but variants failed - log but don't fail the request
      } else {
        createdVariants = variantData;
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product: {
          ...product,
          product_variants: createdVariants
        }
      }
    });

  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update product
 * Admin only
 */
const updateProduct = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { id } = req.params;
    const { title, slug, price, images, description, is_active } = req.body;

    const updates = {};
    if (title) updates.title = title;
    if (slug) updates.slug = slug;
    if (price !== undefined) updates.price = Math.round(price);
    if (images) updates.images = images;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        product_variants (
          id,
          size,
          stock_quantity,
          price_override
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });

  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete product
 * Admin only - cascades to variants via DB constraint
 */
const deleteProduct = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Add variant to existing product
 * Admin only
 */
const addVariant = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { productId } = req.params;
    const { size, stock_quantity, price_override } = req.body;

    if (!size) {
      return res.status(400).json({
        success: false,
        message: 'Size is required'
      });
    }

    const { data: variant, error } = await supabase
      .from('product_variants')
      .insert({
        product_id: productId,
        size,
        stock_quantity: stock_quantity || 0,
        price_override: price_override ? Math.round(price_override) : null
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Variant added successfully',
      data: { variant }
    });

  } catch (error) {
    console.error('Add variant error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update variant stock
 * Admin only
 */
const updateVariantStock = async (req, res) => {
  try {
    // Verify admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { variantId } = req.params;
    const { stock_quantity } = req.body;

    if (stock_quantity === undefined || stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock_quantity is required (>= 0)'
      });
    }

    const { data: variant, error } = await supabase
      .from('product_variants')
      .update({ stock_quantity })
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Variant not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Variant stock updated successfully',
      data: { variant }
    });

  } catch (error) {
    console.error('Update variant stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariantStock
};
