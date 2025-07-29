#!/bin/bash

# =============================================================================
# CREATE TEST ACCOUNTS FOR FRONTEND TESTING
# =============================================================================

BASE_URL="http://localhost:8005/api"

echo "🔐 CREATING TEST ACCOUNTS FOR FRONTEND LOGIN"
echo "============================================="

echo ""
echo "👤 Creating Employee Test Account..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frontend Test Employee",
    "email": "employee@test.com",
    "password": "Test123",
    "employeeId": "TEST001",
    "department": "Engineering",
    "phone": "+1234567890",
    "role": "employee"
  }' | jq '.success, .message'

echo ""
echo "👑 Creating Admin Test Account..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frontend Test Admin",
    "email": "admin@test.com", 
    "password": "Admin123",
    "employeeId": "ADMIN001",
    "department": "Operations",
    "phone": "+1234567891",
    "role": "admin"
  }' | jq '.success, .message'

echo ""
echo "👥 Creating HR Test Account..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frontend Test HR",
    "email": "hr@test.com",
    "password": "Hr123test",
    "employeeId": "HR001", 
    "department": "HR",
    "phone": "+1234567892",
    "role": "hr"
  }' | jq '.success, .message'

echo ""
echo "✅ TEST ACCOUNTS CREATED!"
echo "========================"
echo ""
echo "📝 FRONTEND LOGIN CREDENTIALS:"
echo "=============================="
echo ""
echo "🟢 EMPLOYEE ACCOUNT:"
echo "   Email: employee@test.com"
echo "   Password: Test123!"
echo "   Role: employee"
echo "   Department: Engineering"
echo ""
echo "🔴 ADMIN ACCOUNT:"
echo "   Email: admin@test.com"
echo "   Password: Admin123!"
echo "   Role: admin"
echo "   Department: Operations"
echo ""
echo "🟡 HR ACCOUNT:"
echo "   Email: hr@test.com"
echo "   Password: HR123!"
echo "   Role: hr"
echo "   Department: Human Resources"
echo ""
echo "⚠️  NOTE: These accounts require email verification for employees."
echo "   Admin and HR accounts can login without verification."
echo ""
echo "🧪 You can now use these credentials to test the frontend!"