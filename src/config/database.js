const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    
    // Connect with auth options
    const conn = await mongoose.connect(mongoUri, {
      authSource: 'admin',
      retryWrites: true,
      w: 'majority'
    });

    console.log(` MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('L MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('� MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log(' MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('=� MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('L MongoDB connection failed:', error.message);
    
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;