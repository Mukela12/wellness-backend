require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Start server
const server = app.listen(PORT, () => {
  console.log(`=€ WellnessAI Backend Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`=ñ Health check: http://localhost:${PORT}/health`);
  console.log(`= API Base URL: http://localhost:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('=¥ UNHANDLED REJECTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions  
process.on('uncaughtException', (err) => {
  console.error('=¥ UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack:', err.stack);
  
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('=K SIGTERM received. Shutting down gracefully...');
  
  server.close(() => {
    console.log('=ô Process terminated');
  });
});

module.exports = server;