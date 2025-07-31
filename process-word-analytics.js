const mongoose = require('mongoose');
const dotenv = require('dotenv');
// Load all models first
const User = require('./src/models/User');
const Journal = require('./src/models/Journal');
const Survey = require('./src/models/Survey');
const CheckIn = require('./src/models/CheckIn');
const WordFrequency = require('./src/models/WordFrequency');
const wordFrequencyService = require('./src/services/wordFrequency.service');

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wellness-backend');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const processAllExistingData = async () => {
  console.log('🚀 Starting word frequency analysis for existing data...\n');
  
  await connectDB();
  
  try {
    // Process existing journal entries
    const journalsProcessed = await wordFrequencyService.processExistingJournals();
    
    // Process existing survey responses
    const surveysProcessed = await wordFrequencyService.processExistingSurveyResponses();
    
    // Process existing check-in feedbacks
    const checkinsProcessed = await wordFrequencyService.processExistingCheckIns();
    
    console.log('\n🎉 Word frequency processing complete!');
    console.log('\n📊 Summary:');
    console.log(`📖 Journal entries processed: ${journalsProcessed}`);
    console.log(`📋 Survey responses processed: ${surveysProcessed}`);
    console.log(`✅ Check-in feedbacks processed: ${checkinsProcessed}`);
    console.log(`🔢 Total entries processed: ${journalsProcessed + surveysProcessed + checkinsProcessed}`);
    
  } catch (error) {
    console.error('❌ Error in word frequency processing:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  processAllExistingData();
}

module.exports = { processAllExistingData };