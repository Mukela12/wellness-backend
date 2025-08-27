const requiredEnvVars = {
  // Core
  'NODE_ENV': 'Environment mode',
  'PORT': 'Server port',
  'MONGODB_URI': 'MongoDB connection string',
  'JWT_SECRET': 'JWT secret key',
  
  // Slack Integration
  'SLACK_CLIENT_ID': 'Slack app client ID',
  'SLACK_CLIENT_SECRET': 'Slack app client secret',
  'SLACK_SIGNING_SECRET': 'Slack signing secret for request verification',
  'SLACK_BOT_TOKEN': 'Slack bot user OAuth token',
  
  // Optional but recommended
  'EMAIL_HOST': 'Email SMTP host (optional)',
  'EMAIL_USER': 'Email username (optional)',
  'EMAIL_PASS': 'Email password (optional)',
};

function checkProductionReadiness() {
  console.log('🔍 Checking production readiness...\n');
  
  const missing = [];
  const optional = [];
  
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    const isOptional = description.includes('optional');
    
    if (!value) {
      if (isOptional) {
        optional.push(`  ⚠️  ${key} - ${description}`);
      } else {
        missing.push(`  ❌ ${key} - ${description}`);
      }
    } else {
      console.log(`  ✅ ${key} - ${description}`);
    }
  }
  
  if (optional.length > 0) {
    console.log('\n⚠️  Optional variables not set:');
    optional.forEach(v => console.log(v));
  }
  
  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:');
    missing.forEach(v => console.log(v));
    console.log('\n🚨 Production deployment will fail without these variables!');
    process.exit(1);
  } else {
    console.log('\n✅ All required environment variables are set!');
  }
  
  // Additional checks
  console.log('\n📋 Additional checks:');
  
  // Check Slack signature secret format
  if (process.env.SLACK_SIGNING_SECRET && !process.env.SLACK_SIGNING_SECRET.match(/^[a-f0-9]{32}$/)) {
    console.log('  ⚠️  SLACK_SIGNING_SECRET should be a 32-character hex string');
  } else {
    console.log('  ✅ SLACK_SIGNING_SECRET format looks correct');
  }
  
  // Check bot token format
  if (process.env.SLACK_BOT_TOKEN && !process.env.SLACK_BOT_TOKEN.startsWith('xoxb-')) {
    console.log('  ⚠️  SLACK_BOT_TOKEN should start with "xoxb-"');
  } else {
    console.log('  ✅ SLACK_BOT_TOKEN format looks correct');
  }
  
  console.log('\n✨ Production readiness check complete!\n');
}

// Run if called directly
if (require.main === module) {
  checkProductionReadiness();
}

module.exports = checkProductionReadiness;