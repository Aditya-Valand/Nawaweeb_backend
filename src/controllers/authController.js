const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper to create Token
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = async (req, res) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || 'user' // Default to user
    });

    const token = signToken(newUser._id, newUser.role);
    const safeUser = newUser.toObject();
    delete safeUser.password;
    res.status(201).json({ status: 'success', token, data: { user: safeUser } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({ message: "Incorrect email or password" });
    }

    const token = signToken(user._id, user.role);

    res.status(200).json({
      status: "success",
      token,
      role: user.role
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};


// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({ message: "Provide email and password" });
//     }

//     const user = await User.findOne({ email }).select("+password");

//     if (!user || !(await user.matchPassword(password))) {
//   return res.status(401).json({ message: "Incorrect email or password" });
// }


//     const token = signToken(user._id, user.role);

//     res.status(200).json({
//       status: "success",
//       token,
//       role: user.role
//     });

//   } catch (err) {
//     res.status(500).json({ status: "error", message: err.message });
//   }
// };


// GET /me - protected route to return current user's profile
exports.me = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Not authenticated' });
    const current = await User.findById(req.user.id).select('-password');
    if (!current) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ status: 'success', data: { user: current } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};