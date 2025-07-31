const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const CheckIn = require('./src/models/CheckIn');
const Survey = require('./src/models/Survey');
const { DEPARTMENTS, MOOD_SCALE, RISK_LEVELS } = require('./src/config/constants');

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

// Generate realistic names
const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'Mason', 'Isabella', 'James',
  'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Mia', 'Henry', 'Harper', 'Alexander', 'Evelyn', 'Michael',
  'Abigail', 'Daniel', 'Emily', 'Jackson', 'Elizabeth', 'Sebastian', 'Sofia', 'Jack', 'Avery', 'Owen',
  'Ella', 'Luke', 'Madison', 'Jayden', 'Scarlett', 'Connor', 'Victoria', 'Wyatt', 'Aria', 'John',
  'Grace', 'Samuel', 'Chloe', 'David', 'Camila', 'Matthew', 'Penelope', 'Joseph', 'Riley', 'Carter'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const jobTitles = {
  Engineering: ['Software Engineer', 'Senior Developer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'Tech Lead', 'QA Engineer'],
  Marketing: ['Marketing Manager', 'Content Creator', 'Social Media Manager', 'Brand Manager', 'Digital Marketer', 'Marketing Analyst'],
  Sales: ['Sales Representative', 'Account Manager', 'Sales Director', 'Business Development', 'Sales Analyst', 'Key Account Manager'],
  HR: ['HR Manager', 'Recruiter', 'HR Business Partner', 'Talent Acquisition', 'HR Analyst', 'People Operations'],
  Finance: ['Financial Analyst', 'Accountant', 'Finance Manager', 'CFO', 'Budget Analyst', 'Investment Analyst'],
  Operations: ['Operations Manager', 'Process Analyst', 'Supply Chain Manager', 'Project Manager', 'Operations Coordinator'],
  Product: ['Product Manager', 'Product Owner', 'UX Designer', 'UI Designer', 'Product Analyst', 'Product Marketing Manager']
};

// Generate random data helpers
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min, max) => Math.random() * (max - min) + min;
const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Create test employees
const createTestEmployees = async (count = 50) => {
  console.log(`🔄 Creating ${count} test employees...`);
  const employees = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const department = getRandomElement(DEPARTMENTS);
    const employeeId = `EMP${String(i + 1000).padStart(4, '0')}`;
    
    const employee = {
      employeeId,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@company.com`,
      password: await bcrypt.hash('password123', 12),
      department,
      role: 'employee',
      isEmailVerified: true,
      
      // Demographics
      demographics: {
        age: getRandomNumber(22, 65),
        gender: getRandomElement(['male', 'female', 'non-binary', 'prefer-not-to-say']),
        pronouns: getRandomElement(['he/him', 'she/her', 'they/them', 'prefer-not-to-say'])
      },
      
      // Employment info
      employment: {
        hireDate: getRandomDate(new Date('2020-01-01'), new Date()),
        jobTitle: getRandomElement(jobTitles[department]),
        seniority: getRandomElement(['junior', 'mid-level', 'senior', 'lead']),
        workLocation: getRandomElement(['remote', 'hybrid', 'on-site'])
      },
      
      // Personality (optional)
      personality: {
        mbtiType: getRandomElement(['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']),
        workStyle: getRandomElement(['collaborative', 'independent', 'analytical', 'creative', 'detail-oriented']),
        interests: getRandomElement([
          ['technology', 'gaming'], 
          ['fitness', 'health'], 
          ['reading', 'writing'], 
          ['music', 'art'], 
          ['travel', 'cooking']
        ])
      },
      
      // Wellness metrics (will be updated by check-ins)
      wellness: {
        happyCoins: getRandomNumber(0, 2000),
        currentStreak: getRandomNumber(0, 30),
        longestStreak: getRandomNumber(0, 90),
        riskLevel: getRandomElement(Object.values(RISK_LEVELS)),
        riskScore: getRandomFloat(0, 1)
      },
      
      // Onboarding completed
      onboarding: {
        completed: true,
        completedAt: getRandomDate(new Date('2023-01-01'), new Date()),
        answers: new Map([
          ['workPreference', getRandomElement(['remote', 'office', 'hybrid'])],
          ['stressLevel', getRandomNumber(1, 5)],
          ['fitnessGoals', getRandomElement(['weight_loss', 'muscle_gain', 'maintenance', 'endurance'])]
        ])
      }
    };
    
    employees.push(employee);
  }
  
  try {
    const createdEmployees = await User.insertMany(employees);
    console.log(`✅ Created ${createdEmployees.length} test employees`);
    return createdEmployees;
  } catch (error) {
    console.error('❌ Error creating employees:', error);
    return [];
  }
};

// Create historical check-ins for the past 90 days
const createHistoricalCheckIns = async (employees) => {
  console.log('🔄 Creating historical check-ins...');
  const checkIns = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 90); // 90 days ago
  
  for (const employee of employees) {
    // Each employee has different engagement patterns
    const engagementRate = Math.random(); // 0 to 1
    const moodTrend = getRandomElement(['positive', 'stable', 'declining']);
    
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      // Skip some days based on engagement rate
      if (Math.random() > engagementRate) continue;
      
      // Generate mood based on trend
      let baseMood = 3; // neutral
      if (moodTrend === 'positive') baseMood = 4;
      if (moodTrend === 'declining') baseMood = 2;
      
      const moodVariation = getRandomFloat(-0.8, 0.8);
      const mood = Math.max(1, Math.min(5, Math.round(baseMood + moodVariation)));
      
      const checkIn = {
        userId: employee._id,
        date: new Date(d),
        mood: mood,
        feedback: getRandomElement([
          'Had a productive day!',
          'Feeling good about the project progress',
          'Team collaboration was excellent',
          'Could use some rest',
          'Excited about upcoming challenges',
          'Grateful for supportive colleagues',
          'Learning new skills',
          null // Some check-ins have no feedback
        ]),
        source: getRandomElement(['web', 'whatsapp', 'mobile']),
        happyCoinsEarned: 50 + (mood >= 4 ? 25 : 0), // Base + bonus for good mood
        processed: Math.random() > 0.3, // 70% processed
        createdAt: new Date(d)
      };
      
      checkIns.push(checkIn);
    }
  }
  
  try {
    const createdCheckIns = await CheckIn.insertMany(checkIns);
    console.log(`✅ Created ${createdCheckIns.length} historical check-ins`);
    
    // Update user wellness metrics based on check-ins
    await updateUserWellnessMetrics(employees);
    
    return createdCheckIns;
  } catch (error) {
    console.error('❌ Error creating check-ins:', error);
    return [];
  }
};

// Update user wellness metrics based on their check-ins
const updateUserWellnessMetrics = async (employees) => {
  console.log('🔄 Updating user wellness metrics...');
  
  for (const employee of employees) {
    const checkIns = await CheckIn.find({ userId: employee._id }).sort({ date: -1 });
    
    if (checkIns.length === 0) continue;
    
    // Calculate average mood
    const averageMood = checkIns.reduce((sum, ci) => sum + ci.mood, 0) / checkIns.length;
    
    // Calculate current streak
    let currentStreak = 0;
    const sortedCheckIns = checkIns.sort((a, b) => b.date - a.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedCheckIns.length; i++) {
      const checkInDate = new Date(sortedCheckIns[i].date);
      checkInDate.setHours(0, 0, 0, 0);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      
      if (checkInDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate risk based on recent patterns
    const recentCheckIns = checkIns.slice(0, 7); // Last 7 days
    const recentAverageMood = recentCheckIns.length > 0 
      ? recentCheckIns.reduce((sum, ci) => sum + ci.mood, 0) / recentCheckIns.length 
      : 3;
    
    const daysSinceLastCheckIn = checkIns.length > 0 
      ? Math.floor((today - new Date(checkIns[0].date)) / (1000 * 60 * 60 * 24)) 
      : 30;
    
    // Risk calculation (0-100 points, higher = more risk)
    let riskScore = 0;
    if (recentAverageMood < 2.5) riskScore += 30;
    if (daysSinceLastCheckIn > 7) riskScore += 25;
    if (currentStreak === 0) riskScore += 20;
    if (checkIns.length < 10) riskScore += 15; // Low overall engagement
    
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';
    
    // Update user
    await User.findByIdAndUpdate(employee._id, {
      'wellness.averageMood': parseFloat(averageMood.toFixed(2)),
      'wellness.currentStreak': currentStreak,
      'wellness.longestStreak': Math.max(currentStreak, employee.wellness.longestStreak || 0),
      'wellness.lastCheckIn': checkIns[0]?.date,
      'wellness.riskLevel': riskLevel,
      'wellness.riskScore': riskScore / 100, // Convert to 0-1 scale
      'wellness.happyCoins': checkIns.reduce((sum, ci) => sum + (ci.happyCoinsEarned || 50), employee.wellness.happyCoins || 0)
    });
  }
  
  console.log('✅ Updated user wellness metrics');
};

// Create sample surveys
const createSampleSurveys = async (employees) => {
  console.log('🔄 Creating sample surveys...');
  
  // Find an HR user to set as creator, or use first employee
  const hrUser = employees.find(emp => emp.department === 'HR') || employees[0];
  
  const surveys = [
    {
      title: 'Weekly Wellness Pulse',
      description: 'Quick check-in on your weekly wellness and satisfaction',
      type: 'pulse',
      status: 'active',
      priority: 'normal',
      questions: [
        {
          id: 'satisfaction',
          question: 'How satisfied are you with your work-life balance?',
          type: 'scale',
          required: true,
          scale: {
            min: 1,
            max: 5,
            labels: new Map([
              ['1', 'Very Dissatisfied'],
              ['2', 'Dissatisfied'],
              ['3', 'Neutral'],
              ['4', 'Satisfied'],
              ['5', 'Very Satisfied']
            ])
          }
        },
        {
          id: 'stress',
          question: 'What is your current stress level?',
          type: 'scale',
          required: true,
          scale: {
            min: 1,
            max: 5,
            labels: new Map([
              ['1', 'Very Low'],
              ['2', 'Low'],
              ['3', 'Moderate'],
              ['4', 'High'],
              ['5', 'Very High']
            ])
          }
        },
        {
          id: 'support',
          question: 'Do you feel supported by your manager and team?',
          type: 'multiple_choice',
          required: true,
          options: ['Strongly Yes', 'Yes', 'Somewhat', 'No', 'Strongly No']
        },
        {
          id: 'feedback',
          question: 'Any additional feedback or suggestions?',
          type: 'text',
          required: false
        }
      ],
      schedule: {
        frequency: 'weekly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        time: '09:00'
      },
      targetAudience: {
        all: true,
        departments: DEPARTMENTS
      },
      rewards: {
        happyCoins: 75
      },
      createdBy: hrUser._id,
      responses: [] // Will be populated separately
    },
    {
      title: 'Employee Engagement Survey',
      description: 'Monthly comprehensive engagement and culture assessment',
      type: 'feedback',
      status: 'active',
      priority: 'high',
      questions: [
        {
          id: 'job_satisfaction',
          question: 'How satisfied are you with your current role?',
          type: 'scale',
          required: true,
          scale: {
            min: 1,
            max: 5,
            labels: new Map([
              ['1', 'Very Dissatisfied'],
              ['2', 'Dissatisfied'],
              ['3', 'Neutral'],
              ['4', 'Satisfied'],
              ['5', 'Very Satisfied']
            ])
          }
        },
        {
          id: 'career_growth',
          question: 'How would you rate your career growth opportunities?',
          type: 'scale',
          required: true,
          scale: {
            min: 1,
            max: 5,
            labels: new Map([
              ['1', 'Very Poor'],
              ['2', 'Poor'],
              ['3', 'Fair'],
              ['4', 'Good'],
              ['5', 'Excellent']
            ])
          }
        },
        {
          id: 'company_culture',
          question: 'How would you describe our company culture?',
          type: 'multiple_choice',
          required: true,
          options: ['Excellent', 'Good', 'Average', 'Below Average', 'Poor']
        },
        {
          id: 'recommend',
          question: 'How likely are you to recommend this company as a great place to work? (eNPS)',
          type: 'scale',
          required: true,
          scale: {
            min: 0,
            max: 10,
            labels: new Map([
              ['0', 'Not at all likely'],
              ['10', 'Extremely likely']
            ])
          }
        }
      ],
      schedule: {
        frequency: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        time: '10:00'
      },
      targetAudience: {
        all: true,
        departments: DEPARTMENTS
      },
      rewards: {
        happyCoins: 100
      },
      createdBy: hrUser._id,
      responses: []
    }
  ];
  
  try {
    const createdSurveys = await Survey.insertMany(surveys);
    console.log(`✅ Created ${createdSurveys.length} sample surveys`);
    return createdSurveys;
  } catch (error) {
    console.error('❌ Error creating surveys:', error);
    return [];
  }
};

// Create survey responses and add them to surveys
const createSurveyResponses = async (employees, surveys) => {
  console.log('🔄 Creating survey responses...');
  let totalResponses = 0;
  
  for (const survey of surveys) {
    const responses = [];
    
    // Each employee has a chance to respond based on engagement
    for (const employee of employees) {
      const responseRate = Math.random();
      if (responseRate < 0.65) continue; // 65% response rate
      
      const answers = new Map();
      
      for (const question of survey.questions) {
        if (question.type === 'scale') {
          const min = question.scale?.min || 1;
          const max = question.scale?.max || 5;
          answers.set(question.id, getRandomNumber(min, max));
        } else if (question.type === 'multiple_choice') {
          answers.set(question.id, getRandomElement(question.options));
        } else if (question.type === 'text' && Math.random() < 0.3) {
          // 30% chance of text response
          answers.set(question.id, getRandomElement([
            'Overall good experience',
            'Could improve communication',
            'Love the team collaboration',
            'Need better work-life balance',
            'Excited about company direction',
            'Great leadership support',
            'Would like more professional development opportunities'
          ]));
        }
      }
      
      const response = {
        userId: employee._id,
        answers,
        completedAt: getRandomDate(new Date('2024-01-01'), new Date())
      };
      
      responses.push(response);
    }
    
    // Update the survey with responses
    try {
      await Survey.findByIdAndUpdate(survey._id, {
        $set: {
          responses: responses,
          'analytics.totalResponses': responses.length,
          'analytics.responseRate': (responses.length / employees.length) * 100
        }
      });
      
      totalResponses += responses.length;
      console.log(`✅ Added ${responses.length} responses to survey: ${survey.title}`);
    } catch (error) {
      console.error(`❌ Error adding responses to survey ${survey.title}:`, error);
    }
  }
  
  console.log(`✅ Created ${totalResponses} total survey responses`);
  return totalResponses;
};

// Main function to create all test data
const createAllTestData = async () => {
  console.log('🚀 Starting test data creation...\n');
  
  await connectDB();
  
  try {
    // Clear existing test data (optional - uncomment if needed)
    // console.log('🔄 Clearing existing test data...');
    // await User.deleteMany({ email: { $regex: '@company.com$' } });
    // await CheckIn.deleteMany({});
    // await Survey.deleteMany({});
    // await SurveyResponse.deleteMany({});
    // console.log('✅ Cleared existing test data\n');
    
    // Create employees
    const employees = await createTestEmployees(75); // Create 75 test employees
    
    // Create historical check-ins
    await createHistoricalCheckIns(employees);
    
    // Create surveys
    const surveys = await createSampleSurveys(employees);
    
    // Create survey responses
    await createSurveyResponses(employees, surveys);
    
    console.log('\n🎉 Test data creation complete!');
    console.log('\n📊 Summary:');
    console.log(`👥 Employees: ${employees.length}`);
    console.log(`📋 Surveys: ${surveys.length}`);
    console.log(`📈 Departments: ${DEPARTMENTS.join(', ')}`);
    console.log('\n🔐 Login credentials for test employees:');
    console.log('Email: [firstname].[lastname][number]@company.com');
    console.log('Password: password123');
    console.log('Example: emma.smith0@company.com / password123');
    
  } catch (error) {
    console.error('❌ Error in test data creation:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  createAllTestData();
}

module.exports = {
  createAllTestData,
  createTestEmployees,
  createHistoricalCheckIns,
  createSampleSurveys,
  createSurveyResponses
};