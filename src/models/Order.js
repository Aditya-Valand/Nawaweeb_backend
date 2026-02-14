const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // LINKED DATA
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  
  // SELECTION DATA
  orderType: { type: String, enum: ['Handmade', 'Ready-made'], required: true },
  size: { type: String, required: true },
  
  // CUSTOMER DATA
  customerContact: { type: String, required: true }, // Email or Phone
  customerName: { type: String },
  
  // STATUS TRACKING
  status: { 
    type: String, 
    enum: ['Pending', 'Contacted', 'Paid', 'Shipped', 'Cancelled'], 
    default: 'Pending' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);