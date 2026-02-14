const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // CORE IDENTITY
  title: {
  type: String,
  required: true
},
  animeTag: { type: String, required: true }, // e.g., "Uchiha Clan"
  series: { type: String, required: true },   // e.g., "Drop 001 / Winter"
  
  // PRICING LOGIC
  priceReady: { type: Number, required: true }, 
  priceHandmade: { type: Number, required: true }, // Must be 10-40% higher
  
  // CONTENT & MEDIA
  images: {
  type: [String],
  required: true
},
active: {
  type: Boolean,
  default: true
},
 // URL of the product shot
  description: { type: String, required: true }, // Short hook for the grid
  fullDescription: { type: String }, // Detailed story for the product page
  
  // METADATA
  isLimited: { type: Boolean, default: false }, // Triggers "Limited" badge
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);