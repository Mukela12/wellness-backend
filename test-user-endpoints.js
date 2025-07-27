const axios = require('axios');

/**
 * Test script for User Management endpoints
 * Run this to verify all CRUD operations work with the database
 */

// Configuration
const BASE_URL = 'http://localhost:8005/api';
let authToken = '';
let testUserId = '';

// Test data
const testUser = {
  name: 'Test User',
  email: 'testuser@company.com',
  password: 'TestPass123',
  role: 'employee',
  department: 'Engineering',
  employeeId: 'TEST001',
  phone: '+1234567890'
};

const adminCredentials = {
  email: 'admin@company.com', // Update with your admin email
  password: 'admin123' // Update with your admin password
};

// Helper function for API requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      data
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ ${method} ${endpoint} failed:`, error.response?.data?.message || error.message);
    throw error;
  }
}

// Test functions
async function testLogin() {
  console.log('🔑 Testing admin login...');
  const response = await apiRequest('POST', '/auth/login', adminCredentials);
  authToken = response.data.accessToken;
  console.log('✅ Admin login successful');
}

async function testCreateUser() {
  console.log('➕ Testing create user...');
  const response = await apiRequest('POST', '/users', testUser);
  testUserId = response.data.user._id;
  console.log('✅ User created successfully:', response.data.user.name);
}

async function testGetAllUsers() {
  console.log('📋 Testing get all users...');
  const response = await apiRequest('GET', '/users?page=1&limit=10');
  console.log(`✅ Retrieved ${response.data.users.length} users`);
}

async function testGetUserById() {
  console.log('👤 Testing get user by ID...');
  const response = await apiRequest('GET', `/users/${testUserId}`);
  console.log('✅ User retrieved:', response.data.user.name);
}

async function testUpdateUser() {
  console.log('✏️ Testing update user...');
  const updateData = {
    name: 'Updated Test User',
    department: 'Marketing'
  };
  const response = await apiRequest('PUT', `/users/${testUserId}`, updateData);
  console.log('✅ User updated successfully:', response.data.user.name);
}

async function testToggleUserStatus() {
  console.log('🔄 Testing toggle user status...');
  const response = await apiRequest('PATCH', `/users/${testUserId}/status`, { isActive: false });
  console.log('✅ User status updated:', response.data.user.isActive ? 'Active' : 'Inactive');
}

async function testUpdateUserRole() {
  console.log('👨‍💼 Testing update user role...');
  const response = await apiRequest('PATCH', `/users/${testUserId}/role`, { role: 'manager' });
  console.log('✅ User role updated:', response.data.user.role);
}

async function testGetDepartments() {
  console.log('🏢 Testing get departments...');
  const response = await apiRequest('GET', '/users/departments');
  console.log(`✅ Retrieved ${response.data.departments.length} departments:`, response.data.departments);
}

async function testBulkAction() {
  console.log('📦 Testing bulk action (activate)...');
  const response = await apiRequest('POST', '/users/bulk-action', {
    action: 'activate',
    userIds: [testUserId]
  });
  console.log('✅ Bulk action completed:', response.data.affectedCount, 'users affected');
}

async function testDeleteUser() {
  console.log('🗑️ Testing delete user...');
  const response = await apiRequest('DELETE', `/users/${testUserId}`);
  console.log('✅ User deleted successfully:', response.data.deletedUser.name);
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting User Management Endpoints Tests\n');
  
  try {
    await testLogin();
    await testCreateUser();
    await testGetAllUsers();
    await testGetUserById();
    await testUpdateUser();
    await testToggleUserStatus();
    await testUpdateUserRole();
    await testGetDepartments();
    await testBulkAction();
    await testDeleteUser();
    
    console.log('\n🎉 All tests passed! User management endpoints are working correctly.');
  } catch (error) {
    console.log('\n💥 Tests failed. Please check the error above.');
  }
}

// Check if backend is running
async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:8005/health');
    console.log('✅ Backend is running');
    return true;
  } catch (error) {
    console.log('❌ Backend is not running. Please start the server with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('Checking backend health...');
  const isHealthy = await checkHealth();
  
  if (isHealthy) {
    await runTests();
  }
}

// Run the tests
main().catch(console.error);