require('dotenv').config();
const openaiService = require('./src/services/openai.service');

async function testOpenAI() {
  console.log('🧪 Testing OpenAI API connection...');
  console.log('📍 API Key:', process.env.OPENAI_API_KEY ? 'Configured' : 'Missing');
  console.log('🤖 Model:', process.env.OPENAI_MODEL || 'gpt-4o-mini');
  
  try {
    const result = await openaiService.testConnection();
    
    if (result.success) {
      console.log('✅ OpenAI API test successful!');
      console.log('📝 Response:', result.message);
      console.log('🔧 Model used:', result.model);
      console.log('📊 Usage:', result.usage);
    } else {
      console.error('❌ OpenAI API test failed:', result.error);
      if (result.code) {
        console.error('🔍 Error code:', result.code);
      }
    }
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testOpenAI();