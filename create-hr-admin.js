const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wellness-backend');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createAdmins = async () => {
  console.log('🔄 Creating admin accounts...');
  
  try {
    // HR Admin
    const existingHR = await User.findOne({ email: 'hr.admin@company.com' });
    if (!existingHR) {
      const hrAdmin = new User({
        employeeId: 'EMP0001',
        name: 'HR Administrator',
        email: 'hr.admin@company.com',
        password: await bcrypt.hash('admin123', 12),
        department: 'HR',
        role: 'hr',
        isEmailVerified: true,
        demographics: { age: 35, gender: 'prefer-not-to-say' },
        employment: {
          hireDate: new Date('2022-01-01'),
          jobTitle: 'HR Director',
          seniority: 'lead'
        },
        wellness: { happyCoins: 1000, currentStreak: 15, riskLevel: 'low' },
        onboarding: { completed: true, completedAt: new Date() }
      });
      await hrAdmin.save();
      console.log('✅ HR Admin created: hr.admin@company.com / admin123');
    } else {
      console.log('ℹ️  HR Admin already exists');
    }

    // System Admin
    const existingAdmin = await User.findOne({ email: 'admin@company.com' });
    if (!existingAdmin) {
      const admin = new User({
        employeeId: 'EMP0002',
        name: 'System Administrator',
        email: 'admin@company.com',
        password: await bcrypt.hash('admin123', 12),
        department: 'HR',
        role: 'admin',
        isEmailVerified: true,
        demographics: { age: 30, gender: 'prefer-not-to-say' },
        employment: {
          hireDate: new Date('2021-06-01'),
          jobTitle: 'System Administrator',
          seniority: 'senior'
        },
        wellness: { happyCoins: 2000, currentStreak: 25, riskLevel: 'low' },
        onboarding: { completed: true, completedAt: new Date() }
      });
      await admin.save();
      console.log('✅ System Admin created: admin@company.com / admin123');
    } else {
      console.log('ℹ️  System Admin already exists');
    }
    
  } catch (error) {
    console.error('❌ Error creating admins:', error);
  }
};

const main = async () => {
  await connectDB();
  await createAdmins();
  await mongoose.connection.close();
  console.log('✅ Admin creation complete!');
};

main();