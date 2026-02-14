// src/middleware/auth.js
const { supabase } = require('../config/db');

/**
 * Authentication middleware
 * Verifies JWT token from Supabase and attaches user profile to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header required.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Fetch user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Attach user profile to request object
    req.user = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      is_clan_member: profile.is_clan_member
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Admin authorization middleware
 * Must be used after authenticate middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

/**
 * Clan member authorization middleware
 * Must be used after authenticate middleware
 */
const requireClanMember = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.is_clan_member) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Clan membership required.'
    });
  }

  next();
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 * Useful for endpoints that work for both authenticated and anonymous users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid token - continue without user
      req.user = null;
      return next();
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      req.user = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        is_clan_member: profile.is_clan_member
      };
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireClanMember,
  optionalAuth
};
