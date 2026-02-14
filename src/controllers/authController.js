// src/controllers/authController.js
const { supabase } = require('../config/db');
const { sendEmail } = require('../utils/mailer');

/**
 * Register a new user
 * Creates auth user + profile entry
 */
const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and full name are required'
      });
    }

    // Create auth user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for simplicity; set to false if you want email verification
      user_metadata: { full_name }
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    // Create profile entry (this may be handled by DB trigger, but explicit insert ensures data)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role: 'customer', // Default role
        is_clan_member: false
      })
      .select()
      .single();

    if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
      console.error('Profile creation warning:', profileError);
    }

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Our Platform',
        text: `Hi ${full_name}, welcome to our platform!`
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail registration if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name
        }
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

/**
 * Login user
 * Returns JWT token from Supabase
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          is_clan_member: profile.is_clan_member
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    // req.user is attached by auth middleware
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { user: profile }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { full_name, is_clan_member } = req.body;
    const userId = req.user.id;

    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (typeof is_clan_member === 'boolean') updates.is_clan_member = is_clan_member;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: profile }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin: Update user role
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    // Verify admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be customer or admin.'
      });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: data }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateUserRole
};
