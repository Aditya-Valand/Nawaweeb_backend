const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');

dotenv.config();

const products = [
  {
    title: "Akatsuki Cloud Oversized Tee", // Changed from 'name' to 'title'
    animeTag: "Akatsuki / Naruto",
    series: "Shinobi Syndicate",
    priceReady: 1899,
    priceHandmade: 2499,
    description: "Deep navy oversized fit with hand-stitched Akatsuki clouds.",
    fullDescription: "Premium 240 GSM cotton. Each cloud is meticulously hand-embroidered using traditional Lucknowi 'Aari' work to provide a 3D texture.",
    image: "https://your-image-host.com/akatsuki-tee.jpg", 
    isLimited: true
  },
  {
    title: "Uchiha Sigil Linen Shirt", 
    animeTag: "Uchiha Clan / Naruto",
    series: "Ethereal Awadh",
    priceReady: 2299,
    priceHandmade: 2999,
    description: "Beige linen-blend shirt featuring the iconic Uchiha fan in red Chikankari.",
    fullDescription: "A sophisticated fusion of the Uchiha crest and Chikankari floral filler. The back features a large hand-stitched sigil.",
    image: "https://your-image-host.com/uchiha-shirt.jpg", 
    isLimited: false
  },
  {
    title: "Hime Flame Border Shirt",
    animeTag: "Fire Style / Hime",
    series: "Spirit of Agni",
    priceReady: 2199,
    priceHandmade: 2899,
    description: "White resort-collar shirt with vibrant red flame border embroidery.",
    fullDescription: "The border features a repeating hand-stitched flame pattern inspired by fire-style jutsu and traditional Indian paisley.",
    image: "https://your-image-host.com/flame-shirt.jpg", 
    isLimited: true
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("⛩️ Connected to Nawaweeb DB...");
    
    await Product.deleteMany();
    console.log("🧹 Old artifacts cleared.");

    await Product.insertMany(products);
    console.log("🔥 New Artifacts Manifested Successfully!");
    
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedDB();