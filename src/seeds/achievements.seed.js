const { Achievement } = require('../models/Reward');

const defaultAchievements = [
  // Check-in milestones
  {
    name: 'First Steps',
    description: 'Completed your first wellness check-in',
    category: 'checkin',
    icon: '🏆',
    criteria: {
      type: 'total_checkins',
      value: 1,
      description: 'Complete 1 check-in'
    },
    rarity: 'common',
    happyCoinsReward: 50,
    sortOrder: 1,
    isActive: true
  },
  {
    name: 'Wellness Warrior',
    description: 'Completed 10 wellness check-ins',
    category: 'checkin',
    icon: '💪',
    criteria: {
      type: 'total_checkins',
      value: 10,
      description: 'Complete 10 check-ins'
    },
    rarity: 'common',
    happyCoinsReward: 100,
    sortOrder: 2,
    isActive: true
  },
  {
    name: 'Dedicated Member',
    description: 'Completed 30 wellness check-ins',
    category: 'checkin',
    icon: '🌟',
    criteria: {
      type: 'total_checkins',
      value: 30,
      description: 'Complete 30 check-ins'
    },
    rarity: 'rare',
    happyCoinsReward: 200,
    sortOrder: 3,
    isActive: true
  },
  {
    name: 'Wellness Champion',
    description: 'Completed 100 wellness check-ins',
    category: 'checkin',
    icon: '👑',
    criteria: {
      type: 'total_checkins',
      value: 100,
      description: 'Complete 100 check-ins'
    },
    rarity: 'legendary',
    happyCoinsReward: 500,
    sortOrder: 4,
    isActive: true
  },

  // Streak achievements
  {
    name: 'Getting Started',
    description: 'Maintained check-ins for 3 consecutive days',
    category: 'streak',
    icon: '🔥',
    criteria: {
      type: 'streak_days',
      value: 3,
      description: 'Maintain a 3-day streak'
    },
    rarity: 'common',
    happyCoinsReward: 75,
    sortOrder: 5,
    isActive: true
  },
  {
    name: 'Week Warrior',
    description: 'Maintained check-ins for 7 consecutive days',
    category: 'streak',
    icon: '🔥',
    criteria: {
      type: 'streak_days',
      value: 7,
      description: 'Maintain a 7-day streak'
    },
    rarity: 'common',
    happyCoinsReward: 150,
    sortOrder: 6,
    isActive: true
  },
  {
    name: 'Consistency King',
    description: 'Maintained check-ins for 14 consecutive days',
    category: 'streak',
    icon: '⚡',
    criteria: {
      type: 'streak_days',
      value: 14,
      description: 'Maintain a 14-day streak'
    },
    rarity: 'rare',
    happyCoinsReward: 250,
    sortOrder: 7,
    isActive: true
  },
  {
    name: 'Monthly Master',
    description: 'Maintained check-ins for 30 consecutive days',
    category: 'streak',
    icon: '⭐',
    criteria: {
      type: 'streak_days',
      value: 30,
      description: 'Maintain a 30-day streak'
    },
    rarity: 'epic',
    happyCoinsReward: 400,
    sortOrder: 8,
    isActive: true
  },
  {
    name: 'Unstoppable Force',
    description: 'Maintained check-ins for 60 consecutive days',
    category: 'streak',
    icon: '💎',
    criteria: {
      type: 'streak_days',
      value: 60,
      description: 'Maintain a 60-day streak'
    },
    rarity: 'legendary',
    happyCoinsReward: 750,
    sortOrder: 9,
    isActive: true
  },

  // Mood achievements
  {
    name: 'Positivity Pioneer',
    description: 'Maintained good mood (4+) for 5 consecutive check-ins',
    category: 'mood',
    icon: '😊',
    criteria: {
      type: 'consecutive_good_mood',
      value: 5,
      description: 'Maintain good mood for 5 consecutive check-ins'
    },
    rarity: 'common',
    happyCoinsReward: 100,
    sortOrder: 10,
    isActive: true
  },
  {
    name: 'Happiness Hero',
    description: 'Maintained excellent mood (5) for 3 consecutive check-ins',
    category: 'mood',
    icon: '😄',
    criteria: {
      type: 'consecutive_good_mood',
      value: 3,
      description: 'Maintain excellent mood for 3 consecutive check-ins'
    },
    rarity: 'rare',
    happyCoinsReward: 200,
    sortOrder: 11,
    isActive: true
  },

  // Engagement achievements
  {
    name: 'Survey Starter',
    description: 'Completed your first survey',
    category: 'engagement',
    icon: '📋',
    criteria: {
      type: 'survey_completion',
      value: 1,
      description: 'Complete 1 survey'
    },
    rarity: 'common',
    happyCoinsReward: 50,
    sortOrder: 12,
    isActive: true
  },
  {
    name: 'Feedback Champion',
    description: 'Completed 5 surveys',
    category: 'engagement',
    icon: '📊',
    criteria: {
      type: 'survey_completion',
      value: 5,
      description: 'Complete 5 surveys'
    },
    rarity: 'rare',
    happyCoinsReward: 150,
    sortOrder: 13,
    isActive: true
  },

  // Special milestones
  {
    name: 'Team Player',
    description: 'Received peer recognition',
    category: 'special',
    icon: '🤝',
    criteria: {
      type: 'peer_recognition',
      value: 1,
      description: 'Receive peer recognition'
    },
    rarity: 'common',
    happyCoinsReward: 75,
    sortOrder: 14,
    isActive: true
  },
  {
    name: 'Wellness Ambassador',
    description: 'Sent peer recognition to others',
    category: 'special',
    icon: '🌟',
    criteria: {
      type: 'custom',
      value: 1,
      description: 'Send peer recognition'
    },
    rarity: 'common',
    happyCoinsReward: 50,
    sortOrder: 15,
    isActive: true
  }
];

async function seedAchievements() {
  try {
    console.log('🌱 Seeding default achievements...');
    
    // Clear existing achievements to avoid duplicates
    await Achievement.deleteMany({});
    
    // Insert new achievements
    const results = await Achievement.insertMany(defaultAchievements);
    
    console.log(`✅ Successfully seeded ${results.length} achievements:`);
    results.forEach(achievement => {
      console.log(`   - ${achievement.icon} ${achievement.name} (${achievement.rarity})`);
    });
    
    return results;
  } catch (error) {
    console.error('❌ Error seeding achievements:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const mongoose = require('mongoose');
  
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wellness-app')
    .then(() => {
      console.log('📦 Connected to MongoDB');
      return seedAchievements();
    })
    .then(() => {
      console.log('🎉 Achievement seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedAchievements, defaultAchievements };