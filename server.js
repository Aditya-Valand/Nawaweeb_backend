const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet'); // 🛡️ Security Headers
const mongoSanitize = require('express-mongo-sanitize'); // 🛡️ Anti-NoSQL Injection
// const xss = require('xss-clean'); //
// const { xss } = require('express-xss-sanitizer');
const connectDB = require('./src/config/db');

// Import Routes
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const authRoutes = require('./src/routes/authRoutes');

// Load environment variables
dotenv.config();

// Initialize App & Connect DB
const app = express();
connectDB();

// Middleware
app.use(helmet()); // Protects against well-known web vulnerabilities
app.use(cors()); // Enable CORS for your React frontend
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // Prevent NoSQL injection attacks

// Route Mounts
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});
app.use('/api/products', productRoutes); // For Drop management
app.use('/api/orders', orderRoutes);     // For Request Order flow
app.use('/api/auth', authRoutes);       // For Admin/User Login

// Basic Health Check
app.get('/', (req, res) => {
  res.send('Nawaweeb API is running... ⚔️');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Clan Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});