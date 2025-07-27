const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./src/models/User');

// Test users data
const testUsers = [
  {
    employeeId: 'ADM001',
    email: 'admin@wellness.com',
    password: 'admin123',
    name: 'Admin User',
    phone: '+1234567890',
    department: 'administration',
    role: 'admin',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 150,
      currentStreak: 5,
      longestStreak: 12,
      averageMood: 4.2,
      riskLevel: 'low'
    }
  },
  {
    employeeId: 'HR001',
    email: 'hr@wellness.com',
    password: 'hr123456',
    name: 'HR Manager',
    phone: '+1234567891',
    department: 'human_resources',
    role: 'hr',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 120,
      currentStreak: 3,
      longestStreak: 8,
      averageMood: 3.8,
      riskLevel: 'low'
    }
  },
  {
    employeeId: 'EMP001',
    email: 'employee1@wellness.com',
    password: 'emp123456',
    name: 'John Smith',
    phone: '+1234567892',
    department: 'engineering',
    role: 'employee',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 80,
      currentStreak: 2,
      longestStreak: 6,
      averageMood: 3.5,
      riskLevel: 'medium'
    }
  },
  {
    employeeId: 'EMP002',
    email: 'employee2@wellness.com',
    password: 'emp123456',
    name: 'Sarah Johnson',
    phone: '+1234567893',
    department: 'marketing',
    role: 'employee',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 95,
      currentStreak: 4,
      longestStreak: 7,
      averageMood: 4.0,
      riskLevel: 'low'
    }
  },
  {
    employeeId: 'EMP003',
    email: 'employee3@wellness.com',
    password: 'emp123456',
    name: 'Mike Wilson',
    phone: '+1234567894',
    department: 'sales',
    role: 'employee',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: false
    },
    wellness: {
      happyCoins: 20,
      currentStreak: 0,
      longestStreak: 2,
      averageMood: 2.8,
      riskLevel: 'high'
    }
  },
  {
    employeeId: 'MGR001',
    email: 'manager@wellness.com',
    password: 'mgr123456',
    name: 'Lisa Brown',
    phone: '+1234567895',
    department: 'engineering',
    role: 'manager',
    isEmailVerified: true,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 110,
      currentStreak: 6,
      longestStreak: 10,
      averageMood: 4.1,
      riskLevel: 'low'
    }
  },
  {
    employeeId: 'EMP004',
    email: 'employee4@wellness.com',
    password: 'emp123456',
    name: 'David Garcia',
    phone: '+1234567896',
    department: 'finance',
    role: 'employee',
    isEmailVerified: false,
    isActive: true,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 60,
      currentStreak: 1,
      longestStreak: 4,
      averageMood: 3.2,
      riskLevel: 'medium'
    }
  },
  {
    employeeId: 'EMP005',
    email: 'employee5@wellness.com',
    password: 'emp123456',
    name: 'Emily Davis',
    phone: '+1234567897',
    department: 'design',
    role: 'employee',
    isEmailVerified: true,
    isActive: false,
    onboarding: {
      completed: true,
      completedAt: new Date()
    },
    wellness: {
      happyCoins: 45,
      currentStreak: 0,
      longestStreak: 3,
      averageMood: 3.0,
      riskLevel: 'medium'
    }
  }
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB successfully!');

    // Clear existing users (optional - comment out if you want to keep existing data)
    console.log('Clearing existing users...');
    await User.deleteMany({});
    console.log('Existing users cleared.');

    // Hash passwords and create users
    console.log('Creating test users...');
    const usersToCreate = [];

    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      usersToCreate.push({
        ...userData,
        password: hashedPassword
      });
    }

    // Insert users
    const createdUsers = await User.insertMany(usersToCreate);
    console.log(`Successfully created ${createdUsers.length} test users:`);
    
    createdUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role} - Department: ${user.department}`);
    });

    // Display login credentials
    console.log('\n=== LOGIN CREDENTIALS ===');
    testUsers.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
    });

    console.log('\nTest users seeded successfully!');

  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
}

// Run the seeding
seedUsers();