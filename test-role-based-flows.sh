#!/bin/bash

# WellnessAI Backend - Complete Role-Based User Flow Testing
# Tests all endpoints for each user role: Employee, HR, Admin

BASE_URL="http://localhost:8005/api"
TIMESTAMP=$(date +%s)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "=============================================="
echo "WellnessAI Backend - Role-Based Flow Testing"
echo "=============================================="
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Helper function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    local expected_status=$5
    local test_name=$6
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -H "Authorization: Bearer $token" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X DELETE -H "Authorization: Bearer $token" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        if [ "$body" != "" ]; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name (Expected: $expected_status, Got: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$body" != "" ]; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
    fi
    echo ""
}

# Test public endpoints
echo "======================================"
echo "🌐 TESTING PUBLIC ENDPOINTS"
echo "======================================"

test_endpoint "GET" "/health" "" "" 200 "Health Check"
test_endpoint "GET" "/" "" "" 200 "API Documentation"

# Test WhatsApp webhook endpoints (public)
test_endpoint "GET" "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=123" "" "" 403 "WhatsApp Webhook Verification (Expected Fail - Wrong Token)"

echo "======================================"
echo "👤 EMPLOYEE USER FLOW TESTING"
echo "======================================"

# 1. Employee Registration
EMPLOYEE_EMAIL="employee${TIMESTAMP}@company.com"
EMPLOYEE_ID="EMP${TIMESTAMP}"
EMPLOYEE_DATA='{
    "name": "John Employee",
    "email": "'$EMPLOYEE_EMAIL'",
    "password": "Employee123",
    "employeeId": "'$EMPLOYEE_ID'",
    "department": "Engineering",
    "phone": "+1234567890"
}'

echo "1.1 Employee Registration"
EMPLOYEE_REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "$EMPLOYEE_DATA")
echo "$EMPLOYEE_REGISTER_RESPONSE" | jq '.'
echo ""

# 2. Employee Login
echo "1.2 Employee Login"
LOGIN_DATA='{"email": "'$EMPLOYEE_EMAIL'", "password": "Employee123"}'
EMPLOYEE_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "$LOGIN_DATA")
EMPLOYEE_TOKEN=$(echo $EMPLOYEE_LOGIN_RESPONSE | jq -r '.data.accessToken')
EMPLOYEE_USER_ID=$(echo $EMPLOYEE_LOGIN_RESPONSE | jq -r '.data.user.id')
echo "$EMPLOYEE_LOGIN_RESPONSE" | jq '.'
echo "Employee Token: ${EMPLOYEE_TOKEN:0:50}..."
echo ""

# 3. Employee Authentication Endpoints
echo "1.3 Employee Authentication & Profile Tests"
test_endpoint "GET" "/auth/profile" "$EMPLOYEE_TOKEN" "" 200 "Get Employee Profile"
test_endpoint "POST" "/auth/resend-verification" "$EMPLOYEE_TOKEN" '{"email": "'$EMPLOYEE_EMAIL'"}' 200 "Resend Verification Email"
test_endpoint "POST" "/auth/refresh" "$EMPLOYEE_TOKEN" '{}' 401 "Refresh Token (Expected Fail - No Refresh Token)"

# 4. Employee Onboarding Flow
echo "1.4 Employee Onboarding Tests"
test_endpoint "GET" "/onboarding/questionnaire" "$EMPLOYEE_TOKEN" "" 200 "Get Onboarding Questionnaire"
test_endpoint "GET" "/onboarding/status" "$EMPLOYEE_TOKEN" "" 200 "Get Onboarding Status"

ONBOARDING_DATA='{
    "answers": {
        "ageRange": "25-34",
        "department": "Engineering",
        "workType": "Hybrid",
        "currentStressLevel": 3,
        "sleepQuality": 4,
        "exerciseFrequency": "Sometimes (1-2 times/week)",
        "workLifeBalance": 3,
        "wellnessGoals": ["Reduce stress", "Better work-life balance"],
        "reminderPreference": "Email",
        "comfortSeeking": 4
    },
    "sectionCompleted": "complete"
}'
test_endpoint "POST" "/onboarding/submit" "$EMPLOYEE_TOKEN" "$ONBOARDING_DATA" 200 "Submit Onboarding Questionnaire"

# 5. Employee Check-ins
echo "1.5 Employee Check-in Tests"
test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "Check Today's Check-in Status"

CHECKIN_DATA='{
    "mood": 4,
    "energy": 3,
    "stress": 2,
    "productivity": 4,
    "workload": 3,
    "notes": "Feeling productive today!",
    "goals": ["Complete project review", "Team meeting"]
}'
test_endpoint "POST" "/checkins" "$EMPLOYEE_TOKEN" "$CHECKIN_DATA" 201 "Create Daily Check-in"

test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "Check Today's Check-in Status (After Check-in)"
test_endpoint "GET" "/checkins?limit=5" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in History"
test_endpoint "GET" "/checkins/trend?days=7" "$EMPLOYEE_TOKEN" "" 200 "Get Mood Trend"
test_endpoint "GET" "/checkins/stats" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in Statistics"

# 6. Employee Profile Management
echo "1.6 Employee Profile Management Tests"
PROFILE_UPDATE_DATA='{
    "name": "John Updated Employee",
    "phone": "+9876543210"
}'
test_endpoint "PUT" "/profile" "$EMPLOYEE_TOKEN" "$PROFILE_UPDATE_DATA" 200 "Update Profile"

PREFERENCES_DATA='{
    "notifications": {
        "checkInReminder": true,
        "preferredChannel": "whatsapp",
        "reminderTime": "09:00"
    },
    "personality": {
        "interests": ["Mental health", "Productivity"],
        "stressManagement": ["Exercise", "Meditation"]
    }
}'
test_endpoint "PUT" "/profile/preferences" "$EMPLOYEE_TOKEN" "$PREFERENCES_DATA" 200 "Update Preferences"
test_endpoint "GET" "/profile/wellness-stats?period=30" "$EMPLOYEE_TOKEN" "" 200 "Get Wellness Statistics"

# 7. Employee AI Services
echo "1.7 Employee AI Services Tests"
test_endpoint "GET" "/ai/test" "$EMPLOYEE_TOKEN" "" 200 "Test AI Connection"
test_endpoint "GET" "/ai/status" "$EMPLOYEE_TOKEN" "" 200 "Get AI Service Status"
test_endpoint "GET" "/ai/insights" "$EMPLOYEE_TOKEN" "" 200 "Get Personalized AI Insights"
test_endpoint "GET" "/ai/summary/weekly?weeks=1" "$EMPLOYEE_TOKEN" "" 200 "Get AI Weekly Summary"

# 8. Employee Surveys
echo "1.8 Employee Survey Tests"
test_endpoint "GET" "/surveys/templates" "$EMPLOYEE_TOKEN" "" 200 "Get Survey Templates"
test_endpoint "GET" "/surveys/active" "$EMPLOYEE_TOKEN" "" 200 "Get Active Surveys"
test_endpoint "GET" "/surveys" "$EMPLOYEE_TOKEN" "" 200 "Get All Surveys"

# 9. Employee Challenges
echo "1.9 Employee Challenge Tests"
test_endpoint "GET" "/challenges/templates" "$EMPLOYEE_TOKEN" "" 200 "Get Challenge Templates"
test_endpoint "GET" "/challenges/active" "$EMPLOYEE_TOKEN" "" 200 "Get Active Challenges"
test_endpoint "GET" "/challenges/my-challenges" "$EMPLOYEE_TOKEN" "" 200 "Get My Challenges"
test_endpoint "GET" "/challenges" "$EMPLOYEE_TOKEN" "" 200 "Get All Challenges"

# 10. Employee Resources
echo "1.10 Employee Resource Tests"
test_endpoint "GET" "/resources/categories" "$EMPLOYEE_TOKEN" "" 200 "Get Resource Categories"
test_endpoint "GET" "/resources/featured" "$EMPLOYEE_TOKEN" "" 200 "Get Featured Resources"
test_endpoint "GET" "/resources/popular" "$EMPLOYEE_TOKEN" "" 200 "Get Popular Resources"
test_endpoint "GET" "/resources/my-history" "$EMPLOYEE_TOKEN" "" 200 "Get My Resource History"
test_endpoint "GET" "/resources" "$EMPLOYEE_TOKEN" "" 200 "Get All Resources"

# 11. Employee Rewards
echo "1.11 Employee Reward Tests"
test_endpoint "GET" "/rewards/categories" "$EMPLOYEE_TOKEN" "" 200 "Get Reward Categories"
test_endpoint "GET" "/rewards/featured" "$EMPLOYEE_TOKEN" "" 200 "Get Featured Rewards"
test_endpoint "GET" "/rewards" "$EMPLOYEE_TOKEN" "" 200 "Get All Rewards"
test_endpoint "GET" "/rewards/redemptions/my-redemptions" "$EMPLOYEE_TOKEN" "" 200 "Get My Redemptions"
test_endpoint "GET" "/rewards/achievements/all" "$EMPLOYEE_TOKEN" "" 200 "Get All Achievements"
test_endpoint "GET" "/rewards/achievements/my-achievements" "$EMPLOYEE_TOKEN" "" 200 "Get My Achievements"
test_endpoint "GET" "/rewards/recognitions/my-recognitions" "$EMPLOYEE_TOKEN" "" 200 "Get My Recognitions"
test_endpoint "GET" "/rewards/recognitions/team" "$EMPLOYEE_TOKEN" "" 200 "Get Team Recognitions"

# 12. Employee Access Denied Tests (Should fail)
echo "1.12 Employee Access Denied Tests (Should Fail)"
test_endpoint "GET" "/analytics/company-overview" "$EMPLOYEE_TOKEN" "" 403 "Company Analytics (Access Denied)"
test_endpoint "POST" "/whatsapp/send-message" "$EMPLOYEE_TOKEN" '{"phoneNumber": "+1234567890", "message": "test"}' 403 "WhatsApp Send Message (Access Denied)"
test_endpoint "POST" "/whatsapp/send-reminder" "$EMPLOYEE_TOKEN" '{"userId": "'$EMPLOYEE_USER_ID'"}' 403 "WhatsApp Send Reminder (Access Denied)"

# 13. Employee WhatsApp Status (Should work)
echo "1.13 Employee WhatsApp Access Tests"
test_endpoint "GET" "/whatsapp/status" "$EMPLOYEE_TOKEN" "" 200 "WhatsApp Service Status"

echo "======================================"
echo "👨‍💼 HR USER FLOW TESTING"
echo "======================================"

# 1. HR Registration
HR_EMAIL="hr${TIMESTAMP}@company.com"
HR_ID="HR${TIMESTAMP}"
HR_DATA='{
    "name": "Sarah HR Manager",
    "email": "'$HR_EMAIL'",
    "password": "HRSecure123",
    "employeeId": "'$HR_ID'",
    "department": "HR",
    "role": "hr"
}'

echo "2.1 HR Registration"
HR_REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "$HR_DATA")
echo "$HR_REGISTER_RESPONSE" | jq '.'
echo ""

# 2. HR Login
echo "2.2 HR Login"
HR_LOGIN_DATA='{"email": "'$HR_EMAIL'", "password": "HRSecure123"}'
HR_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "$HR_LOGIN_DATA")
HR_TOKEN=$(echo $HR_LOGIN_RESPONSE | jq -r '.data.accessToken')
HR_USER_ID=$(echo $HR_LOGIN_RESPONSE | jq -r '.data.user.id')
echo "$HR_LOGIN_RESPONSE" | jq '.'
echo "HR Token: ${HR_TOKEN:0:50}..."
echo ""

# 3. HR All Employee Features (Should work)
echo "2.3 HR Employee Feature Access Tests"
test_endpoint "GET" "/auth/profile" "$HR_TOKEN" "" 200 "HR Get Profile"
test_endpoint "GET" "/checkins/today" "$HR_TOKEN" "" 200 "HR Check Today's Status"
test_endpoint "GET" "/ai/insights" "$HR_TOKEN" "" 200 "HR Get AI Insights"
test_endpoint "GET" "/rewards" "$HR_TOKEN" "" 200 "HR Get Rewards"

# 4. HR Analytics (Should work)
echo "2.4 HR Analytics Access Tests"
test_endpoint "GET" "/analytics/company-overview" "$HR_TOKEN" "" 200 "HR Company Overview"
test_endpoint "GET" "/analytics/department/Engineering" "$HR_TOKEN" "" 200 "HR Department Analytics"
test_endpoint "GET" "/analytics/risk-assessment" "$HR_TOKEN" "" 200 "HR Risk Assessment"
test_endpoint "GET" "/analytics/engagement" "$HR_TOKEN" "" 200 "HR Engagement Metrics"

# 5. HR Team Management
echo "2.5 HR Team Management Tests"
test_endpoint "GET" "/team/overview" "$HR_TOKEN" "" 200 "HR Team Overview"
test_endpoint "GET" "/team/mood-trend" "$HR_TOKEN" "" 200 "HR Team Mood Trend"
test_endpoint "GET" "/team/risk-assessment" "$HR_TOKEN" "" 200 "HR Team Risk Assessment"
test_endpoint "GET" "/team/survey-participation" "$HR_TOKEN" "" 200 "HR Survey Participation"
test_endpoint "GET" "/team/engagement" "$HR_TOKEN" "" 200 "HR Team Engagement"

# 6. HR Survey Management
echo "2.6 HR Survey Management Tests"
SURVEY_DATA='{
    "title": "HR Weekly Pulse Survey",
    "type": "pulse",
    "description": "Weekly team wellness check",
    "questions": [
        {
            "id": "mood_this_week",
            "question": "How has your mood been this week?",
            "type": "scale",
            "scale": {"min": 1, "max": 5}
        }
    ],
    "targetDepartments": ["Engineering"],
    "deadline": "2025-08-01T23:59:59.000Z"
}'
test_endpoint "POST" "/surveys" "$HR_TOKEN" "$SURVEY_DATA" 201 "HR Create Survey"
test_endpoint "GET" "/surveys" "$HR_TOKEN" "" 200 "HR Get All Surveys"

# 7. HR Challenge Management
echo "2.7 HR Challenge Management Tests"
CHALLENGE_DATA='{
    "title": "HR 30-Day Wellness Challenge",
    "description": "Complete daily check-ins for 30 days",
    "type": "team",
    "duration": 30,
    "goal": {
        "type": "daily_checkins",
        "target": 30,
        "unit": "check-ins"
    },
    "targetDepartments": ["Engineering"]
}'
test_endpoint "POST" "/challenges" "$HR_TOKEN" "$CHALLENGE_DATA" 201 "HR Create Challenge"

# 8. HR Resource Management
echo "2.8 HR Resource Management Tests"
RESOURCE_DATA='{
    "title": "HR Stress Management Guide",
    "description": "Comprehensive guide for managing workplace stress",
    "category": "mental-health",
    "type": "article",
    "content": "This is a stress management guide...",
    "tags": ["stress", "mental-health", "workplace"]
}'
test_endpoint "POST" "/resources" "$HR_TOKEN" "$RESOURCE_DATA" 201 "HR Create Resource"

# 9. HR Reward Management
echo "2.9 HR Reward Management Tests"
REWARD_DATA='{
    "name": "HR Wellness Day Off",
    "description": "Extra day off for wellness activities",
    "category": "time-off",
    "cost": 500,
    "availability": {
        "inStock": true,
        "quantity": 10
    }
}'
test_endpoint "POST" "/rewards" "$HR_TOKEN" "$REWARD_DATA" 201 "HR Create Reward"

# 10. HR WhatsApp Messaging (Should work)
echo "2.10 HR WhatsApp Messaging Tests"
test_endpoint "GET" "/whatsapp/status" "$HR_TOKEN" "" 200 "HR WhatsApp Status"
WHATSAPP_MESSAGE_DATA='{
    "phoneNumber": "+1234567890",
    "message": "Hello from HR team! How are you doing today?"
}'
test_endpoint "POST" "/whatsapp/send-message" "$HR_TOKEN" "$WHATSAPP_MESSAGE_DATA" 500 "HR Send WhatsApp Message (Expected 500 - No Meta API)"

# 11. HR Access Denied Tests (Should fail - Admin only)
echo "2.11 HR Access Denied Tests (Should Fail - Admin Only)"
test_endpoint "POST" "/whatsapp/send-reminder" "$HR_TOKEN" '{"userId": "'$EMPLOYEE_USER_ID'"}' 403 "HR Send Reminder (Access Denied)"
test_endpoint "POST" "/whatsapp/send-report" "$HR_TOKEN" '{"userId": "'$EMPLOYEE_USER_ID'"}' 403 "HR Send Report (Access Denied)"

echo "======================================"
echo "👨‍💻 ADMIN USER FLOW TESTING"
echo "======================================"

# 1. Admin Registration
ADMIN_EMAIL="admin${TIMESTAMP}@company.com"
ADMIN_ID="ADMIN${TIMESTAMP}"
ADMIN_DATA='{
    "name": "Mike Admin User",
    "email": "'$ADMIN_EMAIL'",
    "password": "AdminSecure123",
    "employeeId": "'$ADMIN_ID'",
    "department": "Engineering",
    "role": "admin"
}'

echo "3.1 Admin Registration"
ADMIN_REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "$ADMIN_DATA")
echo "$ADMIN_REGISTER_RESPONSE" | jq '.'
echo ""

# 2. Admin Login
echo "3.2 Admin Login"
ADMIN_LOGIN_DATA='{"email": "'$ADMIN_EMAIL'", "password": "AdminSecure123"}'
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "$ADMIN_LOGIN_DATA")
ADMIN_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | jq -r '.data.accessToken')
ADMIN_USER_ID=$(echo $ADMIN_LOGIN_RESPONSE | jq -r '.data.user.id')
echo "$ADMIN_LOGIN_RESPONSE" | jq '.'
echo "Admin Token: ${ADMIN_TOKEN:0:50}..."
echo ""

# 3. Admin All Features (Should work)
echo "3.3 Admin Full Access Tests"
test_endpoint "GET" "/auth/profile" "$ADMIN_TOKEN" "" 200 "Admin Get Profile"
test_endpoint "GET" "/analytics/company-overview" "$ADMIN_TOKEN" "" 200 "Admin Company Overview"
test_endpoint "GET" "/team/overview" "$ADMIN_TOKEN" "" 200 "Admin Team Overview"

# 4. Admin User Management
echo "3.4 Admin User Management Tests"
test_endpoint "GET" "/analytics/company-overview" "$ADMIN_TOKEN" "" 200 "Admin Company Overview"
test_endpoint "GET" "/analytics/risk-assessment" "$ADMIN_TOKEN" "" 200 "Admin Risk Assessment"
test_endpoint "GET" "/analytics/engagement" "$ADMIN_TOKEN" "" 200 "Admin Engagement Analytics"

# 5. Admin Survey Management
echo "3.5 Admin Survey Management Tests"
ADMIN_SURVEY_DATA='{
    "title": "Admin Company-Wide Survey",
    "type": "custom",
    "description": "Comprehensive company wellness survey",
    "questions": [
        {
            "id": "overall_satisfaction",
            "question": "How satisfied are you with your overall work experience?",
            "type": "scale",
            "scale": {"min": 1, "max": 10}
        }
    ],
    "targetDepartments": ["Engineering", "HR", "Marketing"],
    "deadline": "2025-08-15T23:59:59.000Z"
}'
test_endpoint "POST" "/surveys" "$ADMIN_TOKEN" "$ADMIN_SURVEY_DATA" 201 "Admin Create Company Survey"

# 6. Admin Challenge Management
echo "3.6 Admin Challenge Management Tests"
ADMIN_CHALLENGE_DATA='{
    "title": "Admin Company Wellness Challenge",
    "description": "Company-wide 60-day wellness initiative",
    "type": "company_wide",
    "duration": 60,
    "goal": {
        "type": "daily_checkins",
        "target": 60,
        "unit": "check-ins"
    }
}'
test_endpoint "POST" "/challenges" "$ADMIN_TOKEN" "$ADMIN_CHALLENGE_DATA" 201 "Admin Create Company Challenge"

# 7. Admin Resource Management
echo "3.7 Admin Resource Management Tests"
ADMIN_RESOURCE_DATA='{
    "title": "Admin Employee Wellness Handbook",
    "description": "Complete guide to employee wellness programs",
    "category": "handbook",
    "type": "document",
    "content": "This is the complete employee wellness handbook...",
    "tags": ["handbook", "wellness", "guidelines"],
    "featured": true
}'
test_endpoint "POST" "/resources" "$ADMIN_TOKEN" "$ADMIN_RESOURCE_DATA" 201 "Admin Create Featured Resource"

# 8. Admin Reward Management
echo "3.8 Admin Reward Management Tests"
ADMIN_REWARD_DATA='{
    "name": "Admin Premium Wellness Package",
    "description": "Premium wellness benefits package",
    "category": "premium",
    "cost": 1000,
    "originalPrice": 500,
    "discount": 20,
    "featured": true,
    "availability": {
        "inStock": true,
        "quantity": 5
    }
}'
test_endpoint "POST" "/rewards" "$ADMIN_TOKEN" "$ADMIN_REWARD_DATA" 201 "Admin Create Premium Reward"

# 9. Admin Achievement Management
echo "3.9 Admin Achievement Management Tests"
ACHIEVEMENT_DATA='{
    "name": "Admin Created Achievement",
    "description": "Special achievement created by admin",
    "icon": "🏆",
    "category": "special",
    "rarity": "legendary",
    "requirements": {
        "type": "streak",
        "target": 30
    },
    "reward": {
        "happyCoins": 500,
        "badge": "30-Day Legend"
    }
}'
test_endpoint "POST" "/rewards/achievements" "$ADMIN_TOKEN" "$ACHIEVEMENT_DATA" 201 "Admin Create Achievement"

# 10. Admin WhatsApp Full Access
echo "3.10 Admin WhatsApp Full Access Tests"
test_endpoint "GET" "/whatsapp/status" "$ADMIN_TOKEN" "" 200 "Admin WhatsApp Status"

ADMIN_WHATSAPP_MESSAGE_DATA='{
    "phoneNumber": "+1234567890",
    "message": "Important message from Admin: Please complete your wellness check-in today."
}'
test_endpoint "POST" "/whatsapp/send-message" "$ADMIN_TOKEN" "$ADMIN_WHATSAPP_MESSAGE_DATA" 500 "Admin Send WhatsApp Message (Expected 500 - No Meta API)"

ADMIN_REMINDER_DATA='{
    "userId": "'$EMPLOYEE_USER_ID'",
    "reminderType": "daily_checkin"
}'
test_endpoint "POST" "/whatsapp/send-reminder" "$ADMIN_TOKEN" "$ADMIN_REMINDER_DATA" 500 "Admin Send Reminder (Expected 500 - No Meta API)"

ADMIN_REPORT_DATA='{
    "userId": "'$EMPLOYEE_USER_ID'"
}'
test_endpoint "POST" "/whatsapp/send-report" "$ADMIN_TOKEN" "$ADMIN_REPORT_DATA" 500 "Admin Send Report (Expected 500 - No Meta API)"

# 11. Admin AI Risk Assessment
echo "3.11 Admin AI Risk Assessment Tests"
test_endpoint "GET" "/ai/risk-assessment/$EMPLOYEE_USER_ID" "$ADMIN_TOKEN" "" 200 "Admin AI Risk Assessment"

# 12. Admin Analytics Export
echo "3.12 Admin Analytics Export Tests"
test_endpoint "GET" "/analytics/export?format=json&startDate=2025-07-01&endDate=2025-07-31" "$ADMIN_TOKEN" "" 200 "Admin Export Analytics"

echo "======================================"
echo "🔒 SECURITY & VALIDATION TESTING"
echo "======================================"

# Test invalid tokens
echo "4.1 Invalid Token Tests"
test_endpoint "GET" "/auth/profile" "invalid_token" "" 401 "Invalid Token Access"
test_endpoint "GET" "/analytics/company-overview" "invalid_token" "" 401 "Invalid Token Analytics"

# Test missing tokens
echo "4.2 Missing Token Tests"
test_endpoint "GET" "/auth/profile" "" "" 401 "Missing Token Access"
test_endpoint "POST" "/checkins" "" "$CHECKIN_DATA" 401 "Missing Token Check-in"

# Test malformed requests
echo "4.3 Malformed Request Tests"
test_endpoint "POST" "/auth/register" "" '{"invalid": "data"}' 400 "Invalid Registration Data"
test_endpoint "POST" "/auth/login" "" '{"email": "invalid"}' 400 "Invalid Login Data"

echo "======================================"
echo "📊 FINAL TEST SUMMARY"
echo "======================================"

echo -e "${BLUE}Total Tests Run: $TOTAL_TESTS${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo "✅ Employee Flow: Complete"
    echo "✅ HR Flow: Complete"  
    echo "✅ Admin Flow: Complete"
    echo "✅ Security: Validated"
    echo "✅ Role-Based Access: Working"
else
    echo -e "${RED}❌ Some tests failed. Check output above.${NC}"
fi

echo ""
echo "Test completed at: $(date)"
echo "=============================================="