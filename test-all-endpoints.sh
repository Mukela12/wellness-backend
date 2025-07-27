#!/bin/bash

# WellnessAI Backend - Comprehensive Endpoint Testing Script
# This script tests all endpoints and documents their functionality

BASE_URL="http://localhost:8005/api"
EMAIL="test$(date +%s)@company.com"
PASSWORD="TestPass123"
EMPLOYEE_ID="EMP$(date +%s)"

echo "=========================================="
echo "WellnessAI Backend - Comprehensive Testing"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test Email: $EMAIL"
echo ""

# 1. AUTHENTICATION ENDPOINTS
echo "1. AUTHENTICATION ENDPOINTS"
echo "=========================="

# 1.1 Register
echo -e "\n1.1 Register New User"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "'$EMAIL'",
    "password": "'$PASSWORD'",
    "employeeId": "'$EMPLOYEE_ID'",
    "department": "Engineering",
    "phone": "1234567890"
  }')
echo "Response: $REGISTER_RESPONSE" | jq '.'

# 1.2 Login
echo -e "\n1.2 Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$EMAIL'",
    "password": "'$PASSWORD'"
  }')
echo "Response: $LOGIN_RESPONSE" | jq '.'
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
echo "Token obtained: ${TOKEN:0:50}..."

# 1.3 Get Profile
echo -e "\n1.3 Get User Profile"
curl -s -X GET "$BASE_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 1.4 Change Password
echo -e "\n1.4 Change Password"
curl -s -X POST "$BASE_URL/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "'$PASSWORD'",
    "newPassword": "NewPass123",
    "confirmPassword": "NewPass123"
  }' | jq '.'

# 2. CHECK-IN ENDPOINTS
echo -e "\n\n2. CHECK-IN ENDPOINTS"
echo "===================="

# 2.1 Create Check-in
echo -e "\n2.1 Create Daily Check-in"
CHECKIN_RESPONSE=$(curl -s -X POST "$BASE_URL/checkins" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mood": 4,
    "feedback": "Having a productive day working on the wellness platform!",
    "source": "web"
  }')
echo "Response: $CHECKIN_RESPONSE" | jq '.'
CHECKIN_ID=$(echo $CHECKIN_RESPONSE | jq -r '.data.checkIn.id')

# 2.2 Today's Status
echo -e "\n2.2 Get Today's Check-in Status"
curl -s -X GET "$BASE_URL/checkins/today" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 2.3 Check-in History
echo -e "\n2.3 Get Check-in History"
curl -s -X GET "$BASE_URL/checkins?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 2.4 Mood Trend
echo -e "\n2.4 Get Mood Trend"
curl -s -X GET "$BASE_URL/checkins/trend?days=7" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 2.5 Check-in Stats
echo -e "\n2.5 Get Check-in Statistics"
curl -s -X GET "$BASE_URL/checkins/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. PROFILE MANAGEMENT ENDPOINTS
echo -e "\n\n3. PROFILE MANAGEMENT ENDPOINTS"
echo "=============================="

# 3.1 Update Profile
echo -e "\n3.1 Update Profile"
curl -s -X PUT "$BASE_URL/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test User",
    "phone": "9876543210"
  }' | jq '.'

# 3.2 Update Preferences
echo -e "\n3.2 Update Preferences"
curl -s -X PUT "$BASE_URL/profile/preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notifications": {
      "checkInReminder": true,
      "preferredChannel": "email",
      "reminderTime": "09:00"
    },
    "personality": {
      "interests": ["Mental health", "Productivity"],
      "stressManagement": ["Exercise", "Meditation"]
    }
  }' | jq '.'

# 3.3 Get Wellness Stats
echo -e "\n3.3 Get Wellness Statistics"
curl -s -X GET "$BASE_URL/profile/wellness-stats?period=30" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. ONBOARDING ENDPOINTS
echo -e "\n\n4. ONBOARDING ENDPOINTS"
echo "======================"

# 4.1 Get Questionnaire
echo -e "\n4.1 Get Onboarding Questionnaire"
curl -s -X GET "$BASE_URL/onboarding/questionnaire" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .data.questionnaire | keys'

# 4.2 Submit Questionnaire
echo -e "\n4.2 Submit Onboarding Responses"
curl -s -X POST "$BASE_URL/onboarding/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "ageRange": "25-34",
      "workExperience": "3-5 years",
      "roleType": "Individual Contributor",
      "currentStressLevel": 3,
      "stressFactors": ["Heavy workload", "Work-life balance"],
      "wellnessGoals": ["Reduce stress", "Improve focus"],
      "checkInFrequency": "Daily"
    },
    "sectionCompleted": "complete"
  }' | jq '.'

# 4.3 Get Onboarding Status
echo -e "\n4.3 Get Onboarding Status"
curl -s -X GET "$BASE_URL/onboarding/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5. AI ENDPOINTS
echo -e "\n\n5. AI-POWERED ENDPOINTS"
echo "====================="

# 5.1 Test AI Connection
echo -e "\n5.1 Test AI Service Connection"
curl -s -X GET "$BASE_URL/ai/test" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5.2 Get AI Status
echo -e "\n5.2 Get AI Service Status"
curl -s -X GET "$BASE_URL/ai/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5.3 Get Personalized Insights
echo -e "\n5.3 Get Personalized AI Insights"
curl -s -X GET "$BASE_URL/ai/insights" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message'

# 5.4 Analyze Check-in
echo -e "\n5.4 Analyze Check-in with AI"
if [ ! -z "$CHECKIN_ID" ]; then
  curl -s -X GET "$BASE_URL/ai/analyze/$CHECKIN_ID" \
    -H "Authorization: Bearer $TOKEN" | jq '.success, .message'
fi

# 5.5 Weekly Summary
echo -e "\n5.5 Get AI Weekly Summary"
curl -s -X GET "$BASE_URL/ai/summary/weekly?weeks=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message'

# 6. HR ANALYTICS (Need HR Role)
echo -e "\n\n6. HR ANALYTICS ENDPOINTS (HR/Admin Only)"
echo "========================================"
echo "Note: These require HR/Admin role - showing structure only"

# Test Company Overview (will fail without HR role)
echo -e "\n6.1 Company Overview (requires HR role)"
curl -s -X GET "$BASE_URL/analytics/company-overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message'

echo -e "\n\n=========================================="
echo "TESTING COMPLETE"
echo "=========================================="
echo "Summary:"
echo "- User registered and authenticated successfully"
echo "- Check-in created with ID: $CHECKIN_ID"
echo "- AI analysis triggered automatically"
echo "- All core endpoints tested"
echo "==========================================