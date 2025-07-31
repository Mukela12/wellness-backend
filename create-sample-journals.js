const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const Journal = require('./src/models/Journal');

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

// Sample journal entries with diverse content
const sampleJournalEntries = [
  {
    title: "Great Team Collaboration Today",
    content: "Had an amazing day collaborating with my team on the new project. Everyone was so supportive and creative. We brainstormed innovative solutions and I feel really motivated about our progress. The positive energy in the room was incredible and I'm grateful to work with such talented people. Looking forward to tomorrow's challenges.",
    mood: 5,
    category: 'work',
    tags: ['collaboration', 'teamwork', 'motivation', 'gratitude']
  },
  {
    title: "Feeling Overwhelmed with Deadlines",
    content: "Today was really stressful with multiple deadlines approaching. I'm feeling overwhelmed and anxious about getting everything done on time. The workload seems impossible and I'm struggling to prioritize. Need to talk to my manager about realistic expectations. Taking deep breaths and trying to focus on one task at a time.",
    mood: 2,
    category: 'work',
    tags: ['stress', 'anxiety', 'deadlines', 'overwhelmed']
  },
  {
    title: "Wellness Walk During Lunch",
    content: "Took a refreshing walk during lunch break today. The fresh air and sunshine really helped clear my mind and boost my energy. It's amazing how a simple 20-minute walk can make such a difference in how I feel. Planning to make this a daily habit for better work-life balance and mental health.",
    mood: 4,
    category: 'wellness',
    tags: ['exercise', 'mindfulness', 'energy', 'balance']
  },
  {
    title: "Learning New Skills",
    content: "Spent time today learning about new technologies and professional development. It's exciting to grow and expand my knowledge. The online course was challenging but rewarding. I feel confident about implementing these new skills in my work. Continuous learning keeps me engaged and motivated.",
    mood: 4,
    category: 'personal',
    tags: ['learning', 'growth', 'skills', 'development']
  },
  {
    title: "Difficult Conversation with Manager",
    content: "Had a challenging conversation with my manager today about my career goals and performance. While it was uncomfortable, I think it was necessary and productive. We discussed areas for improvement and potential opportunities. Feeling uncertain about the future but hopeful that we can work together to find solutions.",
    mood: 3,
    category: 'work',
    tags: ['career', 'feedback', 'uncertainty', 'communication']
  },
  {
    title: "Grateful for Supportive Colleagues",
    content: "Really appreciated how my colleagues stepped in to help when I was struggling with a difficult task today. Their kindness and willingness to share knowledge made all the difference. It reminds me why I love working here - the people truly care about each other's success. Feeling blessed to be part of such a supportive team.",
    mood: 5,
    category: 'work',
    tags: ['gratitude', 'support', 'kindness', 'teamwork']
  },
  {
    title: "Work-Life Balance Struggles",
    content: "Finding it hard to maintain a healthy work-life balance lately. Work demands are increasing and I'm bringing stress home. Need to set better boundaries and prioritize self-care. My family deserves my full attention when I'm home. Planning to discuss flexible working arrangements with HR.",
    mood: 2,
    category: 'wellness',
    tags: ['balance', 'stress', 'boundaries', 'family']
  },
  {
    title: "Successful Project Completion",
    content: "Finally completed the major project we've been working on for months! The sense of accomplishment is incredible. The team worked so hard and it really paid off. Our client was thrilled with the results. Celebrating this win and looking forward to the next challenge. Hard work and dedication really do make a difference.",
    mood: 5,
    category: 'work',
    tags: ['success', 'accomplishment', 'dedication', 'celebration']
  },
  {
    title: "Mental Health Check-in",
    content: "Taking a moment to reflect on my mental health and overall well-being. Some days are harder than others, but I'm learning to be more patient with myself. Therapy has been helpful in developing coping strategies. Grateful for the mental health resources available at work. Self-compassion is a daily practice.",
    mood: 3,
    category: 'wellness',
    tags: ['mental health', 'therapy', 'self-compassion', 'coping']
  },
  {
    title: "Innovation Workshop Inspiration",
    content: "Attended an amazing innovation workshop today that really sparked my creativity. Met fascinating people from different departments and learned about their unique perspectives. The breakout sessions were engaging and I came away with several ideas to implement in my own work. These learning opportunities are invaluable for professional growth.",
    mood: 4,
    category: 'personal',
    tags: ['innovation', 'creativity', 'networking', 'inspiration']
  },
  {
    title: "Remote Work Productivity",
    content: "Working from home today was incredibly productive. No office distractions allowed me to focus deeply on complex tasks. The quiet environment and flexibility really suit my work style. However, I do miss the social interaction with colleagues. Finding the right balance between remote and office work is key to my satisfaction.",
    mood: 4,
    category: 'work',
    tags: ['remote work', 'productivity', 'focus', 'flexibility']
  },
  {
    title: "Dealing with Imposter Syndrome",
    content: "Struggling with imposter syndrome again today. Despite positive feedback, I keep doubting my abilities and feeling like I don't belong. It's frustrating because logically I know I'm qualified and capable. Working on building confidence and recognizing my achievements. Talking to my mentor really helps put things in perspective.",
    mood: 2,
    category: 'personal',
    tags: ['confidence', 'self-doubt', 'mentorship', 'growth']
  }
];

// Helper functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const createSampleJournals = async () => {
  console.log('🔄 Creating sample journal entries...');
  
  try {
    // Get all test employees
    const employees = await User.find({ 
      email: { $regex: '@company.com$' },
      role: 'employee' 
    });
    
    if (employees.length === 0) {
      console.log('❌ No test employees found. Please run create-test-data.js first');
      return;
    }
    
    const journals = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 60 days ago
    const endDate = new Date();
    
    // Create journal entries for random employees
    for (let i = 0; i < 150; i++) { // Create 150 journal entries
      const employee = getRandomElement(employees);
      const sampleEntry = getRandomElement(sampleJournalEntries);
      
      // Add some variation to the content
      const variations = [
        "Today was particularly interesting because ",
        "I've been thinking about how ",
        "What struck me most was ",
        "I realized that ",
        "Looking back on today, "
      ];
      
      const contentVariation = Math.random() > 0.7 ? 
        getRandomElement(variations) + sampleEntry.content.toLowerCase() :
        sampleEntry.content;
      
      const journal = {
        userId: employee._id,
        title: sampleEntry.title,
        content: contentVariation,
        mood: sampleEntry.mood,
        category: sampleEntry.category,
        tags: sampleEntry.tags,
        createdAt: getRandomDate(startDate, endDate),
        updatedAt: getRandomDate(startDate, endDate),
        wordCount: contentVariation.split(' ').length,
        readingTime: Math.ceil(contentVariation.split(' ').length / 200),
        status: 'completed'
      };
      
      journals.push(journal);
    }
    
    // Insert journal entries
    const createdJournals = await Journal.insertMany(journals);
    console.log(`✅ Created ${createdJournals.length} sample journal entries`);
    
    return createdJournals;
  } catch (error) {
    console.error('❌ Error creating sample journals:', error);
    throw error;
  }
};

const main = async () => {
  console.log('🚀 Creating sample journal entries for word analytics...\n');
  
  await connectDB();
  
  try {
    await createSampleJournals();
    
    console.log('\n🎉 Sample journal creation complete!');
    console.log('\n💡 Next steps:');
    console.log('1. Run: node process-word-analytics.js');
    console.log('2. This will analyze all journal entries for word frequency');
    console.log('3. Then test the word analytics API endpoints');
    
  } catch (error) {
    console.error('❌ Error in sample journal creation:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createSampleJournals };