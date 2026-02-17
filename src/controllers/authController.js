const { supabase } = require('../config/db');
const { sendEmail, getResetPasswordTemplate } = require('../utils/mailer');
const crypto = require('crypto');

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
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name
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
    let { email, password } = req.body;

    // Ensure email and password are strings
    email = String(email).trim();
    password = String(password).trim();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    console.log('Login attempt for:', email);

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Login auth error:', authError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: authError.message
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
      token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        is_clan_member: profile.is_clan_member
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
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // 1. Check if user exists (Using Admin to bypass "View own profile" RLS)
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    // If user not found or error, return generic message for security
    if (findError || !profile) {
      return res.status(200).json({
        success: true,
        message: 'If this email exists, reset link has been sent.'
      });
    }

    // 2. Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Expiry = 10 minutes (Ensure it is converted to ISO string for DB)
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 3. Save in DB (Using Admin to bypass "Update own profile" RLS)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        reset_token: resetToken,
        reset_token_expiry: expiry
      })
      .eq('id', profile.id);

    // If the DB update failed, stop here! Do not send the email.
    if (updateError) {
      console.error('Failed to save reset token:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Could not process request'
      });
    }

    // 4. Create reset link
    // Make sure this matches your Frontend Route exactly (including the /:token part)
    const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

    // 5. Send enhanced email
    await sendEmail({
      to: email,
      subject: 'Password Reset Request - Nawaweeb',
      html: getResetPasswordTemplate(resetLink)
    });

    return res.status(200).json({
      success: true,
      message: 'Reset link sent to email.'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // 1. Validation
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // 2. Find user with token (Using Admin to bypass RLS)
    const { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('reset_token', token)
      .single();

    // If no profile found with that token, the link is invalid
    if (findError || !profile) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or tampered link'
      });
    }

    // 3. Check expiry
    const isExpired = new Date(profile.reset_token_expiry) < new Date();
    if (isExpired) {
      return res.status(400).json({
        success: false,
        message: 'Link expired'
      });
    }

    // 4. Update the actual Auth password
    // Note: auth.admin.updateUserById is already an admin operation
    const { error: authError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: password }
    );

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    // 5. Clean up the token (Using Admin to ensure the update succeeds)
    await supabase
      .from('profiles')
      .update({
        reset_token: null,
        reset_token_expiry: null
      })
      .eq('id', profile.id);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateUserRole,
  forgotPassword,
  resetPassword
};
