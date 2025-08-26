require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createTestUser() {
  try {
    // Connect to MongoDB - use the Railway MongoDB
    const mongoUri = 'mongodb://turntable.proxy.rlwy.net:26061';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Create test user
    const testUser = new User({
      employeeId: 'EMP001',
      email: 'mukelathegreat@gmail.com',
      password: 'Test123!',
      name: 'Mukela Katungu',
      phone: '+85256928497',
      department: 'Engineering',
      role: 'employee',
      wellness: {
        happyCoins: 100,
        totalCheckIns: 0,
        currentStreak: 0,
        longestStreak: 0
      },
      isActive: true,
      isEmailVerified: true
    });

    await testUser.save();
    console.log('Test user created successfully:', {
      id: testUser._id,
      email: testUser.email,
      name: testUser.name
    });

    // Disconnect
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestUser();