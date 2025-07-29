const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const User = require('./src/models/User');

async function resetTestPasswords() {
  try {
    console.log('🔐 RESETTING TEST ACCOUNT PASSWORDS...');
    
    // Reset employee account password
    const employeeId = '688797b66f55a1fdf320ae94';
    const newPassword = 'Test123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    const employee = await User.findByIdAndUpdate(employeeId, {
      password: hashedPassword,
      isEmailVerified: true // Also verify email for testing
    });
    
    if (employee) {
      console.log('✅ Employee account password reset successfully');
      console.log(`   Email: ${employee.email}`);
      console.log(`   Password: ${newPassword}`);
      console.log(`   Role: ${employee.role}`);
    } else {
      console.log('❌ Employee account not found');
    }
    
    // Reset admin account password
    const adminId = '68879893305ffdae8daca5a4';
    const adminPassword = 'Admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, saltRounds);
    
    const admin = await User.findByIdAndUpdate(adminId, {
      password: hashedAdminPassword,
      isEmailVerified: true
    });
    
    if (admin) {
      console.log('✅ Admin account password reset successfully');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Role: ${admin.role}`);
    } else {
      console.log('❌ Admin account not found');
    }
    
    console.log('\n🎉 TEST ACCOUNTS READY FOR FRONTEND LOGIN!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

resetTestPasswords();