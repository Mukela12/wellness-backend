require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const whatsappScheduledJobs = require('./services/whatsapp/scheduledJobs');
const surveyScheduler = require('./services/survey.scheduler');
const emailService = require('./services/notifications/email.service');
const openAIService = require('./services/openai.service');
const whatsappService = require('./services/whatsapp/whatsapp.service');
const slackService = require('./services/slack/slack.service');

const PORT = process.env.PORT || 5000;

// Initialize services asynchronously
async function initializeServices() {
  console.log('\n🚀 Starting service initialization...\n');
  
  // Connect to MongoDB
  await connectDB();
  
  // Initialize all services in parallel for faster startup
  const servicePromises = [
    emailService.initialize(),
    openAIService.initialize(),
    whatsappService.initialize(),
    slackService.initialize()
  ];
  
  // Wait for all services to initialize
  await Promise.allSettled(servicePromises);
  
  console.log('\n✅ All services initialization completed\n');
}

// Start server with async initialization
let server;

async function startServer() {
  try {
    // Initialize all services
    await initializeServices();
    
    // Start the server
    server = app.listen(PORT, () => {
      console.log(`=� WellnessAI Backend Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`=� Health check: http://localhost:${PORT}/health`);
      console.log(`= API Base URL: http://localhost:${PORT}/api`);
    });
    
    // Initialize WhatsApp scheduled jobs if credentials are available
    if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      whatsappScheduledJobs.start();
      console.log('📱 WhatsApp scheduled jobs initialized');
    } else {
      console.log('⚠️  WhatsApp credentials not found, scheduled jobs disabled');
    }

    // Initialize Survey Scheduler
    console.log('📋 Survey scheduler initialized');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('=� UNHANDLED REJECTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions  
process.on('uncaughtException', (err) => {
  console.error('=� UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack:', err.stack);
  
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('=K SIGTERM received. Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      // Cleanup survey scheduler
      surveyScheduler.destroy();
      console.log('=� Process terminated');
    });
  } else {
    process.exit(0);
  }
});

module.exports = server;