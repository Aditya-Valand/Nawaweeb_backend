const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("⛩️  Connecting to Nawaweeb DB for Admin setup...");

    // Remove existing admin to avoid unique email conflict
    await User.deleteMany({ role: 'admin' });

    // IMPORTANT: Send plain text password. The User model hook will hash it.
    await User.create({
      name: "Aditya Bhatiya",
      email: "admin@nawaweeb.com",
      password: "nawaweeb2026", 
      role: "admin"
    });

    console.log("🔥 Artisan Admin created successfully!");
    console.log("🔑 Login: admin@nawaweeb.com / nawaweeb2026");
    
    process.exit();
  } catch (error) {
    console.error("❌ Admin seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();