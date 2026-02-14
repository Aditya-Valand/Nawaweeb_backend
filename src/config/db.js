const mongoose = require('mongoose');

const maskUri = (uri) => {
  if (!uri) return '<missing>';
  try {
    // mask credentials if present
    return uri.replace(/:(?:[^:@]+)@/, ':****@');
  } catch {
    return '<invalid>';
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`⛩️  Nawaweeb Database Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database Error full:', error);
    console.error('MONGO_URI (masked):', maskUri(process.env.MONGO_URI));
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
};

module.exports = connectDB;
