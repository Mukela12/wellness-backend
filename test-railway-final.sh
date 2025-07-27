#!/bin/bash

# WellnessAI Backend - Final Comprehensive Railway Testing
# Tests ALL endpoints with EXACT paths verified from each route file

BASE_URL="https://wellness-backend-production-48b1.up.railway.app/api"
TIMESTAMP=$(date +%s)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo "=============================================="
echo "WellnessAI Backend - Final Comprehensive Test"
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
    local skip_reason=$7
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Skip if reason provided
    if [ ! -z "$skip_reason" ]; then
        echo -e "${YELLOW}⚠${NC} $test_name - SKIPPED ($skip_reason)"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        return
    fi
    
    # Build curl command
    local curl_cmd="curl -s -w \"HTTPSTATUS:%{http_code}\""
    
    if [ ! -z "$token" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $token\""
    fi
    
    if [ "$method" != "GET" ] && [ "$method" != "DELETE" ]; then
        curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
    fi
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd -X $method \"$BASE_URL$endpoint\""
    
    # Execute curl command
    response=$(eval $curl_cmd)
    
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $test_name (Status: $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $test_name (Expected: $expected_status, Got: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$http_code" -ge 400 ]; then
            echo "   Error: $(echo $body | jq -r '.message // empty' 2>/dev/null || echo $body | head -c 100)"
        fi
    fi
}

# Test health endpoint first
echo -e "${CYAN}=== Health Check ===${NC}"
test_endpoint "GET" "/../health" "" "" 200 "Health Check"
echo ""

# Test API root documentation
echo -e "${CYAN}=== API Documentation ===${NC}"
test_endpoint "GET" "/" "" "" 200 "API Documentation Root"
echo ""

# Create unique test users
echo -e "${CYAN}=== User Registration ===${NC}"

# Employee user
EMPLOYEE_DATA='{
  "employeeId": "EMP'$TIMESTAMP'",
  "email": "employee'$TIMESTAMP'@wellnessai.com", 
  "password": "TestPass123",
  "name": "Test Employee",
  "department": "Engineering"
}'
test_endpoint "POST" "/auth/register" "" "$EMPLOYEE_DATA" 201 "Register Employee"

# Manager user
MANAGER_DATA='{
  "employeeId": "MGR'$TIMESTAMP'",
  "email": "manager'$TIMESTAMP'@wellnessai.com",
  "password": "TestPass123", 
  "name": "Test Manager",
  "department": "Engineering",
  "role": "manager"
}'
test_endpoint "POST" "/auth/register" "" "$MANAGER_DATA" 201 "Register Manager"

# HR user
HR_DATA='{
  "employeeId": "HR'$TIMESTAMP'",
  "email": "hr'$TIMESTAMP'@wellnessai.com",
  "password": "TestPass123",
  "name": "Test HR",
  "department": "HR", 
  "role": "hr"
}'
test_endpoint "POST" "/auth/register" "" "$HR_DATA" 201 "Register HR"

# Admin user
ADMIN_DATA='{
  "employeeId": "ADM'$TIMESTAMP'",
  "email": "admin'$TIMESTAMP'@wellnessai.com",
  "password": "TestPass123",
  "name": "Test Admin", 
  "department": "Engineering",
  "role": "admin"
}'
test_endpoint "POST" "/auth/register" "" "$ADMIN_DATA" 201 "Register Admin"
echo ""

# Login all users and get tokens
echo -e "${CYAN}=== User Login ===${NC}"

# Login Employee
response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"employee'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' "$BASE_URL/auth/login")
EMPLOYEE_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
EMPLOYEE_ID=$(echo $response | jq -r '.data.user._id // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' 200 "Login Employee"

# Login Manager  
response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"manager'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' "$BASE_URL/auth/login")
MANAGER_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
MANAGER_ID=$(echo $response | jq -r '.data.user._id // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"manager'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' 200 "Login Manager"

# Login HR
response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"hr'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' "$BASE_URL/auth/login")
HR_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
HR_ID=$(echo $response | jq -r '.data.user._id // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"hr'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' 200 "Login HR"

# Login Admin
response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"admin'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' "$BASE_URL/auth/login")
ADMIN_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')  
ADMIN_ID=$(echo $response | jq -r '.data.user._id // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"admin'$TIMESTAMP'@wellnessai.com","password":"TestPass123"}' 200 "Login Admin"
echo ""

# =========================
# AUTH ROUTE TESTS
# =========================
echo -e "${CYAN}=== Auth Endpoints ===${NC}"
test_endpoint "GET" "/auth/profile" "$EMPLOYEE_TOKEN" "" 200 "Get Profile"
test_endpoint "POST" "/auth/refresh" "" '{"refreshToken":"invalid"}' 401 "Refresh Token (Invalid)"
test_endpoint "POST" "/auth/resend-verification" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "Resend Email Verification"
test_endpoint "POST" "/auth/forgot-password" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "Forgot Password"
test_endpoint "POST" "/auth/reset-password" "" '{"token":"invalid","password":"NewPass123"}' 400 "Reset Password (Invalid Token)"
test_endpoint "GET" "/auth/verify-email" "" "token=invalid" 400 "Verify Email (Invalid Token)"
test_endpoint "POST" "/auth/change-password" "$EMPLOYEE_TOKEN" '{"currentPassword":"TestPass123","newPassword":"NewPass123","confirmPassword":"NewPass123"}' 200 "Change Password"

# Logout tests (skip change-password user since we changed their password)
test_endpoint "POST" "/auth/logout" "$MANAGER_TOKEN" "" 200 "Logout User"
test_endpoint "POST" "/auth/logout-all" "$HR_TOKEN" "" 200 "Logout All Devices"
test_endpoint "DELETE" "/auth/account" "$ADMIN_TOKEN" '{"password":"TestPass123"}' 200 "Deactivate Account"
echo ""

# =========================
# CHECKIN ROUTE TESTS 
# =========================
echo -e "${CYAN}=== Check-in Endpoints ===${NC}"
CHECKIN_DATA='{
  "mood": 4,
  "energyLevel": 4,
  "stressLevel": 2,
  "sleepQuality": 4,
  "workload": 3,
  "comment": "Feeling productive",
  "activities": ["exercise", "meditation"]
}'
test_endpoint "POST" "/checkins" "$EMPLOYEE_TOKEN" "$CHECKIN_DATA" 201 "Create Check-in"
test_endpoint "GET" "/checkins" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in History"
test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "Get Today's Check-in"
test_endpoint "GET" "/checkins/trend" "$EMPLOYEE_TOKEN" "" 200 "Get Mood Trend"
test_endpoint "GET" "/checkins/stats" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in Statistics"

# Get check-in ID for update/delete
response=$(curl -s -H "Authorization: Bearer $EMPLOYEE_TOKEN" "$BASE_URL/checkins/today")
CHECKIN_ID=$(echo $response | jq -r '.data.checkIn._id // empty')
if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "PUT" "/checkins/$CHECKIN_ID" "$EMPLOYEE_TOKEN" '{"feedback":"Updated feedback"}' 200 "Update Check-in"
    test_endpoint "DELETE" "/checkins/$CHECKIN_ID" "$EMPLOYEE_TOKEN" "" 200 "Delete Check-in"
else
    test_endpoint "PUT" "/checkins/dummy" "$EMPLOYEE_TOKEN" '{"feedback":"test"}' 404 "Update Check-in" "No check-in ID"
    test_endpoint "DELETE" "/checkins/dummy" "$EMPLOYEE_TOKEN" "" 404 "Delete Check-in" "No check-in ID" 
fi
echo ""

# =========================
# PROFILE ROUTE TESTS
# =========================
echo -e "${CYAN}=== Profile Endpoints ===${NC}"
test_endpoint "PUT" "/profile" "$EMPLOYEE_TOKEN" '{"name":"Updated Name","phone":"1234567890"}' 200 "Update Profile"
test_endpoint "PUT" "/profile/preferences" "$EMPLOYEE_TOKEN" '{"notifications":{"checkInReminder":false},"personality":{"interests":["fitness"]}}' 200 "Update Preferences"  
test_endpoint "GET" "/profile/wellness-stats" "$EMPLOYEE_TOKEN" "" 200 "Get Wellness Stats"
test_endpoint "POST" "/profile/avatar" "$EMPLOYEE_TOKEN" "" 400 "Upload Avatar" "No file upload in test"
test_endpoint "DELETE" "/profile/account" "$EMPLOYEE_TOKEN" '{"password":"NewPass123"}' 200 "Delete Profile Account"
echo ""

# =========================
# ONBOARDING ROUTE TESTS
# =========================
echo -e "${CYAN}=== Onboarding Endpoints ===${NC}"
test_endpoint "GET" "/onboarding/questionnaire" "$MANAGER_TOKEN" "" 200 "Get Onboarding Questionnaire"
test_endpoint "GET" "/onboarding/status" "$MANAGER_TOKEN" "" 200 "Get Onboarding Status"
ONBOARDING_DATA='{
  "responses": {
    "interests": ["fitness", "meditation"],
    "stressors": ["workload"],
    "goals": ["better sleep"],
    "preferredSupport": ["articles", "videos"]
  }
}'
test_endpoint "POST" "/onboarding/submit" "$MANAGER_TOKEN" "$ONBOARDING_DATA" 200 "Submit Onboarding"
echo ""

# =========================
# ANALYTICS ROUTE TESTS  
# =========================
echo -e "${CYAN}=== Analytics Endpoints ===${NC}"
test_endpoint "GET" "/analytics/company-overview" "$HR_TOKEN" "" 200 "Company Overview (HR)"
test_endpoint "GET" "/analytics/department/Engineering" "$HR_TOKEN" "" 200 "Department Analytics (HR)"
test_endpoint "GET" "/analytics/risk-assessment" "$HR_TOKEN" "" 200 "Risk Assessment (HR)"
test_endpoint "GET" "/analytics/engagement" "$HR_TOKEN" "" 200 "Engagement Metrics (HR)"
test_endpoint "GET" "/analytics/export" "$HR_TOKEN" "" 200 "Export Analytics (HR)"
echo ""

# =========================
# AI ROUTE TESTS
# =========================
echo -e "${CYAN}=== AI Endpoints ===${NC}"
test_endpoint "GET" "/ai/test" "$MANAGER_TOKEN" "" 200 "Test AI Service"
test_endpoint "GET" "/ai/insights" "$MANAGER_TOKEN" "" 200 "Get AI Insights"
test_endpoint "GET" "/ai/summary/weekly" "$MANAGER_TOKEN" "" 200 "Weekly AI Summary"
test_endpoint "GET" "/ai/status" "$MANAGER_TOKEN" "" 200 "AI Service Status"
if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "GET" "/ai/analyze/$CHECKIN_ID" "$MANAGER_TOKEN" "" 200 "Analyze Check-in with AI"
else
    test_endpoint "GET" "/ai/analyze/dummy" "$MANAGER_TOKEN" "" 404 "Analyze Check-in with AI" "No check-in ID"
fi
if [ ! -z "$EMPLOYEE_ID" ]; then
    test_endpoint "GET" "/ai/risk-assessment/$EMPLOYEE_ID" "$HR_TOKEN" "" 200 "AI Risk Assessment"  
else
    test_endpoint "GET" "/ai/risk-assessment/dummy" "$HR_TOKEN" "" 404 "AI Risk Assessment" "No employee ID"
fi
echo ""

# =========================
# SURVEY ROUTE TESTS
# =========================
echo -e "${CYAN}=== Survey Endpoints ===${NC}"
test_endpoint "GET" "/surveys/templates" "$MANAGER_TOKEN" "" 200 "Get Survey Templates"
test_endpoint "GET" "/surveys/active" "$MANAGER_TOKEN" "" 200 "Get Active Surveys"  
test_endpoint "GET" "/surveys" "$MANAGER_TOKEN" "" 200 "Get All Surveys"

# Create a survey as HR
SURVEY_DATA='{
  "title": "Test Survey",
  "description": "Testing survey functionality",
  "type": "pulse",
  "questions": [{
    "text": "How satisfied are you?",
    "type": "rating",
    "required": true,
    "options": {"min": 1, "max": 5}
  }],
  "targetAudience": {"departments": ["Engineering"]},
  "schedule": {"frequency": "once"}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $HR_TOKEN" -d "$SURVEY_DATA" "$BASE_URL/surveys")
SURVEY_ID=$(echo $response | jq -r '.data.survey._id // empty')
test_endpoint "POST" "/surveys" "$HR_TOKEN" "$SURVEY_DATA" 201 "Create Survey (HR)"

if [ ! -z "$SURVEY_ID" ]; then
    test_endpoint "GET" "/surveys/$SURVEY_ID" "$MANAGER_TOKEN" "" 200 "Get Survey Details"
    test_endpoint "PUT" "/surveys/$SURVEY_ID" "$HR_TOKEN" '{"title":"Updated Survey Title"}' 200 "Update Survey (HR)"
    test_endpoint "POST" "/surveys/$SURVEY_ID/respond" "$MANAGER_TOKEN" '{"responses":[{"questionId":"q1","value":4}]}' 200 "Submit Survey Response"
    test_endpoint "GET" "/surveys/$SURVEY_ID/analytics" "$HR_TOKEN" "" 200 "Get Survey Analytics (HR)"
    test_endpoint "PATCH" "/surveys/$SURVEY_ID/status" "$HR_TOKEN" '{"status":"completed"}' 200 "Update Survey Status (HR)"
    test_endpoint "DELETE" "/surveys/$SURVEY_ID" "$HR_TOKEN" "" 200 "Delete Survey (HR)"
else
    test_endpoint "GET" "/surveys/dummy" "$MANAGER_TOKEN" "" 404 "Get Survey Details" "No survey created"
    test_endpoint "PUT" "/surveys/dummy" "$HR_TOKEN" '{"title":"test"}' 404 "Update Survey" "No survey created"
    test_endpoint "POST" "/surveys/dummy/respond" "$MANAGER_TOKEN" '{"responses":[]}' 404 "Submit Survey Response" "No survey created"
    test_endpoint "GET" "/surveys/dummy/analytics" "$HR_TOKEN" "" 404 "Get Survey Analytics" "No survey created"
    test_endpoint "PATCH" "/surveys/dummy/status" "$HR_TOKEN" '{"status":"active"}' 404 "Update Survey Status" "No survey created"
    test_endpoint "DELETE" "/surveys/dummy" "$HR_TOKEN" "" 404 "Delete Survey" "No survey created"
fi
echo ""

# =========================
# TEAM ROUTE TESTS
# =========================
echo -e "${CYAN}=== Team Endpoints ===${NC}"
test_endpoint "GET" "/team/overview" "$MANAGER_TOKEN" "" 200 "Team Overview (Manager)"
test_endpoint "GET" "/team/mood-trend" "$MANAGER_TOKEN" "" 200 "Team Mood Trend (Manager)"
test_endpoint "GET" "/team/risk-assessment" "$MANAGER_TOKEN" "" 200 "Team Risk Assessment (Manager)"
test_endpoint "GET" "/team/survey-participation" "$MANAGER_TOKEN" "" 200 "Team Survey Participation (Manager)"
test_endpoint "GET" "/team/engagement" "$MANAGER_TOKEN" "" 200 "Team Engagement (Manager)"
echo ""

# =========================
# CHALLENGE ROUTE TESTS  
# =========================
echo -e "${CYAN}=== Challenge Endpoints ===${NC}"
test_endpoint "GET" "/challenges/templates" "$MANAGER_TOKEN" "" 200 "Get Challenge Templates"
test_endpoint "GET" "/challenges/active" "$MANAGER_TOKEN" "" 200 "Get Active Challenges"
test_endpoint "GET" "/challenges/my-challenges" "$MANAGER_TOKEN" "" 200 "Get My Challenges"
test_endpoint "GET" "/challenges" "$MANAGER_TOKEN" "" 200 "Get All Challenges"

# Create challenge as Manager
CHALLENGE_DATA='{
  "title": "Daily Steps Challenge",
  "description": "Walk 10000 steps daily",
  "type": "individual",
  "category": "fitness",
  "startDate": "'$(date -u +%Y-%m-%d)'",
  "endDate": "'$(date -u -d "+30 days" +%Y-%m-%d)'",
  "target": {"type": "daily", "value": 10000},
  "rewards": {"happyCoins": 100}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $MANAGER_TOKEN" -d "$CHALLENGE_DATA" "$BASE_URL/challenges")
CHALLENGE_ID=$(echo $response | jq -r '.data.challenge._id // empty')
test_endpoint "POST" "/challenges" "$MANAGER_TOKEN" "$CHALLENGE_DATA" 201 "Create Challenge (Manager)"

if [ ! -z "$CHALLENGE_ID" ]; then
    test_endpoint "GET" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" "" 200 "Get Challenge Details"
    test_endpoint "PUT" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" '{"title":"Updated Challenge Title"}' 200 "Update Challenge (Manager)"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/join" "$MANAGER_TOKEN" "" 200 "Join Challenge"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/progress" "$MANAGER_TOKEN" '{"value":5000}' 200 "Update Challenge Progress"
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/leaderboard" "$MANAGER_TOKEN" "" 200 "Get Challenge Leaderboard"
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/analytics" "$MANAGER_TOKEN" "" 200 "Challenge Analytics (Manager)"
    test_endpoint "PATCH" "/challenges/$CHALLENGE_ID/status" "$MANAGER_TOKEN" '{"status":"completed"}' 200 "Update Challenge Status (Manager)"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/leave" "$MANAGER_TOKEN" "" 200 "Leave Challenge"
    test_endpoint "DELETE" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" "" 200 "Delete Challenge (Manager)"
else
    test_endpoint "GET" "/challenges/dummy" "$MANAGER_TOKEN" "" 404 "Get Challenge Details" "No challenge created"
    test_endpoint "PUT" "/challenges/dummy" "$MANAGER_TOKEN" '{"title":"test"}' 404 "Update Challenge" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/join" "$MANAGER_TOKEN" "" 404 "Join Challenge" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/progress" "$MANAGER_TOKEN" '{"value":100}' 404 "Update Progress" "No challenge created"
    test_endpoint "GET" "/challenges/dummy/leaderboard" "$MANAGER_TOKEN" "" 404 "Get Leaderboard" "No challenge created"
    test_endpoint "GET" "/challenges/dummy/analytics" "$MANAGER_TOKEN" "" 404 "Challenge Analytics" "No challenge created"
    test_endpoint "PATCH" "/challenges/dummy/status" "$MANAGER_TOKEN" '{"status":"active"}' 404 "Update Challenge Status" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/leave" "$MANAGER_TOKEN" "" 404 "Leave Challenge" "No challenge created"
    test_endpoint "DELETE" "/challenges/dummy" "$MANAGER_TOKEN" "" 404 "Delete Challenge" "No challenge created"
fi
echo ""

# =========================
# RESOURCE ROUTE TESTS
# =========================
echo -e "${CYAN}=== Resource Endpoints ===${NC}"
test_endpoint "GET" "/resources/categories" "$MANAGER_TOKEN" "" 200 "Get Resource Categories"
test_endpoint "GET" "/resources/featured" "$MANAGER_TOKEN" "" 200 "Get Featured Resources"
test_endpoint "GET" "/resources/popular" "$MANAGER_TOKEN" "" 200 "Get Popular Resources"
test_endpoint "GET" "/resources/my-history" "$MANAGER_TOKEN" "" 200 "Get My Resource History"
test_endpoint "GET" "/resources/category/articles" "$MANAGER_TOKEN" "" 200 "Get Resources by Category"
test_endpoint "GET" "/resources" "$MANAGER_TOKEN" "" 200 "Get All Resources"

# Create resource as Manager
RESOURCE_DATA='{
  "title": "Stress Management Guide",
  "description": "Learn effective stress management techniques",
  "type": "article",
  "category": "mental-health", 
  "content": {"body": "Stress management article content here..."},
  "tags": ["stress", "wellness", "mental-health"]
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $MANAGER_TOKEN" -d "$RESOURCE_DATA" "$BASE_URL/resources")
RESOURCE_ID=$(echo $response | jq -r '.data.resource._id // empty')
test_endpoint "POST" "/resources" "$MANAGER_TOKEN" "$RESOURCE_DATA" 201 "Create Resource (Manager)"

if [ ! -z "$RESOURCE_ID" ]; then
    test_endpoint "GET" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" "" 200 "Get Resource Details"
    test_endpoint "PUT" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" '{"title":"Updated Resource Title"}' 200 "Update Resource (Manager)"
    test_endpoint "POST" "/resources/$RESOURCE_ID/interact" "$MANAGER_TOKEN" '{"action":"view"}' 200 "Interact with Resource"
    test_endpoint "GET" "/resources/$RESOURCE_ID/analytics" "$MANAGER_TOKEN" "" 200 "Resource Analytics (Manager)"
    test_endpoint "PATCH" "/resources/$RESOURCE_ID/status" "$MANAGER_TOKEN" '{"status":"inactive"}' 200 "Update Resource Status (Manager)"
    test_endpoint "DELETE" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" "" 200 "Delete Resource (Manager)"
else
    test_endpoint "GET" "/resources/dummy" "$MANAGER_TOKEN" "" 404 "Get Resource Details" "No resource created"
    test_endpoint "PUT" "/resources/dummy" "$MANAGER_TOKEN" '{"title":"test"}' 404 "Update Resource" "No resource created"
    test_endpoint "POST" "/resources/dummy/interact" "$MANAGER_TOKEN" '{"action":"view"}' 404 "Interact with Resource" "No resource created"
    test_endpoint "GET" "/resources/dummy/analytics" "$MANAGER_TOKEN" "" 404 "Resource Analytics" "No resource created"
    test_endpoint "PATCH" "/resources/dummy/status" "$MANAGER_TOKEN" '{"status":"active"}' 404 "Update Resource Status" "No resource created"
    test_endpoint "DELETE" "/resources/dummy" "$MANAGER_TOKEN" "" 404 "Delete Resource" "No resource created"
fi
echo ""

# =========================
# REWARD ROUTE TESTS
# =========================
echo -e "${CYAN}=== Reward Endpoints ===${NC}"
test_endpoint "GET" "/rewards/categories" "$MANAGER_TOKEN" "" 200 "Get Reward Categories"
test_endpoint "GET" "/rewards/featured" "$MANAGER_TOKEN" "" 200 "Get Featured Rewards"
test_endpoint "GET" "/rewards/category/wellness" "$MANAGER_TOKEN" "" 200 "Get Rewards by Category"
test_endpoint "GET" "/rewards" "$MANAGER_TOKEN" "" 200 "Get All Rewards"

# Create reward as HR
REWARD_DATA='{
  "name": "Spa Day Voucher",
  "description": "Relaxing spa treatment voucher",
  "category": "wellness",
  "type": "voucher",
  "cost": 500,
  "value": 100,
  "availability": {"quantity": 10, "isActive": true}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $HR_TOKEN" -d "$REWARD_DATA" "$BASE_URL/rewards")
REWARD_ID=$(echo $response | jq -r '.data.reward._id // empty')
test_endpoint "POST" "/rewards" "$HR_TOKEN" "$REWARD_DATA" 201 "Create Reward (HR)"

if [ ! -z "$REWARD_ID" ]; then
    test_endpoint "GET" "/rewards/$REWARD_ID" "$MANAGER_TOKEN" "" 200 "Get Reward Details"
    test_endpoint "PUT" "/rewards/$REWARD_ID" "$HR_TOKEN" '{"name":"Updated Spa Voucher"}' 200 "Update Reward (HR)"
    test_endpoint "POST" "/rewards/$REWARD_ID/redeem" "$MANAGER_TOKEN" '{"fulfillment":{"method":"email","email":"test@example.com"}}' 400 "Redeem Reward" "Insufficient coins"
    test_endpoint "DELETE" "/rewards/$REWARD_ID" "$HR_TOKEN" "" 200 "Delete Reward (HR)"
else
    test_endpoint "GET" "/rewards/dummy" "$MANAGER_TOKEN" "" 404 "Get Reward Details" "No reward created"
    test_endpoint "PUT" "/rewards/dummy" "$HR_TOKEN" '{"name":"test"}' 404 "Update Reward" "No reward created"
    test_endpoint "POST" "/rewards/dummy/redeem" "$MANAGER_TOKEN" '{}' 404 "Redeem Reward" "No reward created"
    test_endpoint "DELETE" "/rewards/dummy" "$HR_TOKEN" "" 404 "Delete Reward" "No reward created"
fi

# Redemption endpoints
test_endpoint "GET" "/rewards/redemptions/my-redemptions" "$MANAGER_TOKEN" "" 200 "Get My Redemptions"
test_endpoint "GET" "/rewards/redemptions/dummy" "$MANAGER_TOKEN" "" 404 "Get Redemption Details"
test_endpoint "PATCH" "/rewards/redemptions/dummy/status" "$HR_TOKEN" '{"status":"approved"}' 404 "Update Redemption Status (HR)"
test_endpoint "POST" "/rewards/redemptions/dummy/rate" "$MANAGER_TOKEN" '{"score":5,"feedback":"Great"}' 404 "Rate Redemption"

# Achievement endpoints
test_endpoint "GET" "/rewards/achievements/all" "$MANAGER_TOKEN" "" 200 "Get All Achievements"
test_endpoint "GET" "/rewards/achievements/my-achievements" "$MANAGER_TOKEN" "" 200 "Get My Achievements"

ACHIEVEMENT_DATA='{
  "name": "First Check-in Master",
  "description": "Complete your first daily check-in",
  "category": "milestone",
  "icon": "🎯",
  "criteria": {"type": "total_checkins", "value": 1},
  "happyCoinsReward": 50
}'
test_endpoint "POST" "/rewards/achievements" "$HR_TOKEN" "$ACHIEVEMENT_DATA" 201 "Create Achievement (HR)"

# Recognition endpoints 
if [ ! -z "$MANAGER_ID" ]; then
    RECOGNITION_DATA='{
      "toUserId": "'$MANAGER_ID'",
      "type": "kudos",
      "message": "Great job on the project!",
      "category": "collaboration"
    }'
    test_endpoint "POST" "/rewards/recognitions/send" "$HR_TOKEN" "$RECOGNITION_DATA" 201 "Send Recognition (HR)"
else
    test_endpoint "POST" "/rewards/recognitions/send" "$HR_TOKEN" '{"toUserId":"dummy","type":"kudos","message":"test","category":"collaboration"}' 400 "Send Recognition" "No manager ID"
fi

test_endpoint "GET" "/rewards/recognitions/my-recognitions" "$MANAGER_TOKEN" "" 200 "Get My Recognitions"
test_endpoint "GET" "/rewards/recognitions/team" "$MANAGER_TOKEN" "" 200 "Get Team Recognitions"
echo ""

# =========================
# WHATSAPP ROUTE TESTS
# =========================
echo -e "${CYAN}=== WhatsApp Endpoints ===${NC}"
test_endpoint "GET" "/whatsapp/webhook" "" "hub.verify_token=test&hub.challenge=test123&hub.mode=subscribe" 200 "WhatsApp Webhook Verify" 
test_endpoint "POST" "/whatsapp/webhook" "" '{"entry":[]}' 200 "WhatsApp Webhook Message"
test_endpoint "GET" "/whatsapp/status" "$MANAGER_TOKEN" "" 200 "WhatsApp Service Status"
test_endpoint "POST" "/whatsapp/send-message" "$HR_TOKEN" '{"to":"1234567890","message":"Test message"}' 200 "Send WhatsApp Message (HR)"
if [ ! -z "$MANAGER_ID" ]; then
    test_endpoint "POST" "/whatsapp/send-reminder" "$HR_TOKEN" '{"userId":"'$MANAGER_ID'"}' 200 "Send WhatsApp Reminder (HR)"
else
    test_endpoint "POST" "/whatsapp/send-reminder" "$HR_TOKEN" '{"userId":"dummy"}' 400 "Send WhatsApp Reminder" "No manager ID"
fi
test_endpoint "POST" "/whatsapp/send-report" "$HR_TOKEN" '{"type":"weekly"}' 200 "Send WhatsApp Report (HR)"
test_endpoint "POST" "/whatsapp/test-template" "$HR_TOKEN" '{"template":"check_in_reminder","to":"1234567890"}' 200 "Test WhatsApp Template (HR)"
echo ""

# =========================
# SUMMARY
# =========================
echo ""
echo "=============================================="
echo -e "${BLUE}COMPREHENSIVE TEST SUMMARY${NC}"
echo "=============================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"
echo ""

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo -e "Pass Rate: ${GREEN}${PASS_RATE}%${NC}"
fi

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All active tests passed!${NC}"
    if [ $SKIPPED_TESTS -gt 0 ]; then
        echo -e "${YELLOW}Note: $SKIPPED_TESTS tests were skipped due to dependencies${NC}"
    fi
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS tests failed. Review the results above.${NC}"
    exit 1
fi