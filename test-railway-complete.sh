#!/bin/bash

# WellnessAI Backend - COMPLETE Railway Testing
# Tests ALL endpoints with EXACT paths from ALL route files
# Organized by user roles and permissions

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
echo "WellnessAI Backend - COMPLETE Testing"
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

# Admin2 user (using as manager equivalent)
MANAGER_DATA='{
  "employeeId": "MGR'$TIMESTAMP'",
  "email": "manager'$TIMESTAMP'@wellnessai.com",
  "password": "TestPass123", 
  "name": "Test Manager",
  "department": "Engineering",
  "role": "admin"
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
# AUTH ROUTE TESTS - auth.routes.js
# =========================
echo -e "${CYAN}=== Auth Endpoints (auth.routes.js) ===${NC}"

# PUBLIC ROUTES
test_endpoint "POST" "/auth/refresh" "" '{"refreshToken":"invalid"}' 401 "POST /auth/refresh (Invalid Token)"
test_endpoint "GET" "/auth/verify-email" "" "" 400 "GET /auth/verify-email (Missing Token)"
test_endpoint "POST" "/auth/resend-verification" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "POST /auth/resend-verification"
test_endpoint "POST" "/auth/forgot-password" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "POST /auth/forgot-password"
test_endpoint "POST" "/auth/reset-password" "" '{"token":"invalid","password":"NewPass123"}' 400 "POST /auth/reset-password (Invalid Token)"

# PROTECTED ROUTES
test_endpoint "GET" "/auth/profile" "$EMPLOYEE_TOKEN" "" 200 "GET /auth/profile (Employee)"
test_endpoint "POST" "/auth/change-password" "$EMPLOYEE_TOKEN" '{"currentPassword":"TestPass123","newPassword":"NewPass123","confirmPassword":"NewPass123"}' 200 "POST /auth/change-password (Employee)"
test_endpoint "POST" "/auth/logout" "$MANAGER_TOKEN" "" 200 "POST /auth/logout (Manager)"
test_endpoint "POST" "/auth/logout-all" "$HR_TOKEN" "" 200 "POST /auth/logout-all (HR)"
test_endpoint "DELETE" "/auth/account" "$ADMIN_TOKEN" '{"password":"TestPass123"}' 200 "DELETE /auth/account (Admin)"
echo ""

# =========================
# CHECKIN ROUTE TESTS - checkin.routes.js
# =========================
echo -e "${CYAN}=== Check-in Endpoints (checkin.routes.js) ===${NC}"

CHECKIN_DATA='{
  "mood": 4,
  "energyLevel": 4,
  "stressLevel": 2,
  "sleepQuality": 4,
  "workload": 3,
  "comment": "Feeling productive",
  "activities": ["exercise", "meditation"]
}'

test_endpoint "POST" "/checkins" "$EMPLOYEE_TOKEN" "$CHECKIN_DATA" 201 "POST /checkins (Employee)"
test_endpoint "GET" "/checkins" "$EMPLOYEE_TOKEN" "" 200 "GET /checkins (Employee)"
test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "GET /checkins/today (Employee)"
test_endpoint "GET" "/checkins/trend" "$EMPLOYEE_TOKEN" "" 200 "GET /checkins/trend (Employee)"
test_endpoint "GET" "/checkins/stats" "$EMPLOYEE_TOKEN" "" 200 "GET /checkins/stats (Employee)"

# Get check-in ID for update/delete
response=$(curl -s -H "Authorization: Bearer $EMPLOYEE_TOKEN" "$BASE_URL/checkins/today")
CHECKIN_ID=$(echo $response | jq -r '.data.checkIn._id // empty')
if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "PUT" "/checkins/$CHECKIN_ID" "$EMPLOYEE_TOKEN" '{"feedback":"Updated feedback"}' 200 "PUT /checkins/:id (Employee)"
    test_endpoint "DELETE" "/checkins/$CHECKIN_ID" "$EMPLOYEE_TOKEN" "" 200 "DELETE /checkins/:id (Employee)"
else
    test_endpoint "PUT" "/checkins/dummy" "$EMPLOYEE_TOKEN" '{"feedback":"test"}' 404 "PUT /checkins/:id" "No check-in ID"
    test_endpoint "DELETE" "/checkins/dummy" "$EMPLOYEE_TOKEN" "" 404 "DELETE /checkins/:id" "No check-in ID" 
fi
echo ""

# =========================
# PROFILE ROUTE TESTS - profile.routes.js
# =========================
echo -e "${CYAN}=== Profile Endpoints (profile.routes.js) ===${NC}"

test_endpoint "PUT" "/profile" "$EMPLOYEE_TOKEN" '{"name":"Updated Name","phone":"1234567890"}' 200 "PUT /profile (Employee)"
test_endpoint "PUT" "/profile/preferences" "$EMPLOYEE_TOKEN" '{"notifications":{"checkInReminder":false},"personality":{"interests":["fitness"]}}' 200 "PUT /profile/preferences (Employee)"  
test_endpoint "GET" "/profile/wellness-stats" "$EMPLOYEE_TOKEN" "" 200 "GET /profile/wellness-stats (Employee)"
test_endpoint "POST" "/profile/avatar" "$EMPLOYEE_TOKEN" "" 400 "POST /profile/avatar" "No file upload in test"
test_endpoint "DELETE" "/profile/account" "$EMPLOYEE_TOKEN" '{"password":"NewPass123"}' 200 "DELETE /profile/account (Employee)"
echo ""

# =========================
# ONBOARDING ROUTE TESTS - onboarding.routes.js  
# =========================
echo -e "${CYAN}=== Onboarding Endpoints (onboarding.routes.js) ===${NC}"

test_endpoint "GET" "/onboarding/questionnaire" "$MANAGER_TOKEN" "" 200 "GET /onboarding/questionnaire (Manager)"
test_endpoint "GET" "/onboarding/status" "$MANAGER_TOKEN" "" 200 "GET /onboarding/status (Manager)"

ONBOARDING_DATA='{
  "answers": {
    "interests": ["fitness", "meditation"],
    "stressors": ["workload"],
    "goals": ["better sleep"],
    "preferredSupport": ["articles", "videos"]
  }
}'
test_endpoint "POST" "/onboarding/submit" "$MANAGER_TOKEN" "$ONBOARDING_DATA" 200 "POST /onboarding/submit (Manager)"
echo ""

# =========================
# ANALYTICS ROUTE TESTS - analytics.routes.js
# =========================
echo -e "${CYAN}=== Analytics Endpoints (analytics.routes.js) ===${NC}"

test_endpoint "GET" "/analytics/company-overview" "$HR_TOKEN" "" 200 "GET /analytics/company-overview (HR)"
test_endpoint "GET" "/analytics/department/Engineering" "$HR_TOKEN" "" 200 "GET /analytics/department/:department (HR)"
test_endpoint "GET" "/analytics/risk-assessment" "$HR_TOKEN" "" 200 "GET /analytics/risk-assessment (HR)"
test_endpoint "GET" "/analytics/engagement" "$HR_TOKEN" "" 200 "GET /analytics/engagement (HR)"
test_endpoint "GET" "/analytics/export" "$HR_TOKEN" "" 200 "GET /analytics/export (HR)"
echo ""

# =========================
# AI ROUTE TESTS - ai.routes.js
# =========================
echo -e "${CYAN}=== AI Endpoints (ai.routes.js) ===${NC}"

test_endpoint "GET" "/ai/test" "$MANAGER_TOKEN" "" 200 "GET /ai/test (Manager)"
test_endpoint "GET" "/ai/insights" "$MANAGER_TOKEN" "" 200 "GET /ai/insights (Manager)"
test_endpoint "GET" "/ai/summary/weekly" "$MANAGER_TOKEN" "" 200 "GET /ai/summary/weekly (Manager)"
test_endpoint "GET" "/ai/status" "$MANAGER_TOKEN" "" 200 "GET /ai/status (Manager)"

if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "GET" "/ai/analyze/$CHECKIN_ID" "$MANAGER_TOKEN" "" 200 "GET /ai/analyze/:checkInId (Manager)"
else
    test_endpoint "GET" "/ai/analyze/dummy" "$MANAGER_TOKEN" "" 404 "GET /ai/analyze/:checkInId" "No check-in ID"
fi

if [ ! -z "$EMPLOYEE_ID" ]; then
    test_endpoint "GET" "/ai/risk-assessment/$EMPLOYEE_ID" "$HR_TOKEN" "" 200 "GET /ai/risk-assessment/:userId (HR)"  
else
    test_endpoint "GET" "/ai/risk-assessment/dummy" "$HR_TOKEN" "" 404 "GET /ai/risk-assessment/:userId" "No employee ID"
fi
echo ""

# =========================
# SURVEY ROUTE TESTS - surveyRoutes.js
# =========================
echo -e "${CYAN}=== Survey Endpoints (surveyRoutes.js) ===${NC}"

test_endpoint "GET" "/surveys/templates" "$MANAGER_TOKEN" "" 200 "GET /surveys/templates (Manager)"
test_endpoint "GET" "/surveys/active" "$MANAGER_TOKEN" "" 200 "GET /surveys/active (Manager)"  
test_endpoint "GET" "/surveys" "$MANAGER_TOKEN" "" 200 "GET /surveys (Manager)"

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
test_endpoint "POST" "/surveys" "$HR_TOKEN" "$SURVEY_DATA" 201 "POST /surveys (HR)"

if [ ! -z "$SURVEY_ID" ]; then
    test_endpoint "GET" "/surveys/$SURVEY_ID" "$MANAGER_TOKEN" "" 200 "GET /surveys/:id (Manager)"
    test_endpoint "PUT" "/surveys/$SURVEY_ID" "$HR_TOKEN" '{"title":"Updated Survey Title"}' 200 "PUT /surveys/:id (HR)"
    test_endpoint "POST" "/surveys/$SURVEY_ID/respond" "$MANAGER_TOKEN" '{"responses":[{"questionId":"q1","value":4}]}' 200 "POST /surveys/:id/respond (Manager)"
    test_endpoint "GET" "/surveys/$SURVEY_ID/analytics" "$HR_TOKEN" "" 200 "GET /surveys/:id/analytics (HR)"
    test_endpoint "PATCH" "/surveys/$SURVEY_ID/status" "$HR_TOKEN" '{"status":"completed"}' 200 "PATCH /surveys/:id/status (HR)"
    test_endpoint "DELETE" "/surveys/$SURVEY_ID" "$HR_TOKEN" "" 200 "DELETE /surveys/:id (HR)"
else
    test_endpoint "GET" "/surveys/dummy" "$MANAGER_TOKEN" "" 404 "GET /surveys/:id" "No survey created"
    test_endpoint "PUT" "/surveys/dummy" "$HR_TOKEN" '{"title":"test"}' 404 "PUT /surveys/:id" "No survey created"
    test_endpoint "POST" "/surveys/dummy/respond" "$MANAGER_TOKEN" '{"responses":[]}' 404 "POST /surveys/:id/respond" "No survey created"
    test_endpoint "GET" "/surveys/dummy/analytics" "$HR_TOKEN" "" 404 "GET /surveys/:id/analytics" "No survey created"
    test_endpoint "PATCH" "/surveys/dummy/status" "$HR_TOKEN" '{"status":"active"}' 404 "PATCH /surveys/:id/status" "No survey created"
    test_endpoint "DELETE" "/surveys/dummy" "$HR_TOKEN" "" 404 "DELETE /surveys/:id" "No survey created"
fi
echo ""

# =========================
# TEAM ROUTE TESTS - teamRoutes.js
# =========================
echo -e "${CYAN}=== Team Endpoints (teamRoutes.js) ===${NC}"

test_endpoint "GET" "/team/overview" "$MANAGER_TOKEN" "" 200 "GET /team/overview (Manager)"
test_endpoint "GET" "/team/mood-trend" "$MANAGER_TOKEN" "" 200 "GET /team/mood-trend (Manager)"
test_endpoint "GET" "/team/risk-assessment" "$MANAGER_TOKEN" "" 200 "GET /team/risk-assessment (Manager)"
test_endpoint "GET" "/team/survey-participation" "$MANAGER_TOKEN" "" 200 "GET /team/survey-participation (Manager)"
test_endpoint "GET" "/team/engagement" "$MANAGER_TOKEN" "" 200 "GET /team/engagement (Manager)"
echo ""

# =========================
# CHALLENGE ROUTE TESTS - challengeRoutes.js
# =========================
echo -e "${CYAN}=== Challenge Endpoints (challengeRoutes.js) ===${NC}"

test_endpoint "GET" "/challenges/templates" "$MANAGER_TOKEN" "" 200 "GET /challenges/templates (Manager)"
test_endpoint "GET" "/challenges/active" "$MANAGER_TOKEN" "" 200 "GET /challenges/active (Manager)"
test_endpoint "GET" "/challenges/my-challenges" "$MANAGER_TOKEN" "" 200 "GET /challenges/my-challenges (Manager)"
test_endpoint "GET" "/challenges" "$MANAGER_TOKEN" "" 200 "GET /challenges (Manager)"

# Create challenge as Manager
CHALLENGE_DATA='{
  "title": "Daily Steps Challenge",
  "description": "Walk 10000 steps daily",
  "type": "individual",
  "category": "fitness",
  "startDate": "'$(date -u +%Y-%m-%d)'",
  "endDate": "'$(date -u -v+30d +%Y-%m-%d)'",
  "target": {"type": "daily", "value": 10000},
  "rewards": {"happyCoins": 100}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $MANAGER_TOKEN" -d "$CHALLENGE_DATA" "$BASE_URL/challenges")
CHALLENGE_ID=$(echo $response | jq -r '.data.challenge._id // empty')
test_endpoint "POST" "/challenges" "$MANAGER_TOKEN" "$CHALLENGE_DATA" 201 "POST /challenges (Manager)"

if [ ! -z "$CHALLENGE_ID" ]; then
    test_endpoint "GET" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" "" 200 "GET /challenges/:id (Manager)"
    test_endpoint "PUT" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" '{"title":"Updated Challenge Title"}' 200 "PUT /challenges/:id (Manager)"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/join" "$MANAGER_TOKEN" "" 200 "POST /challenges/:id/join (Manager)"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/progress" "$MANAGER_TOKEN" '{"value":5000}' 200 "POST /challenges/:id/progress (Manager)"
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/leaderboard" "$MANAGER_TOKEN" "" 200 "GET /challenges/:id/leaderboard (Manager)"
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/analytics" "$MANAGER_TOKEN" "" 200 "GET /challenges/:id/analytics (Manager)"
    test_endpoint "PATCH" "/challenges/$CHALLENGE_ID/status" "$MANAGER_TOKEN" '{"status":"completed"}' 200 "PATCH /challenges/:id/status (Manager)"
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/leave" "$MANAGER_TOKEN" "" 200 "POST /challenges/:id/leave (Manager)"
    test_endpoint "DELETE" "/challenges/$CHALLENGE_ID" "$MANAGER_TOKEN" "" 200 "DELETE /challenges/:id (Manager)"
else
    test_endpoint "GET" "/challenges/dummy" "$MANAGER_TOKEN" "" 404 "GET /challenges/:id" "No challenge created"
    test_endpoint "PUT" "/challenges/dummy" "$MANAGER_TOKEN" '{"title":"test"}' 404 "PUT /challenges/:id" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/join" "$MANAGER_TOKEN" "" 404 "POST /challenges/:id/join" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/progress" "$MANAGER_TOKEN" '{"value":100}' 404 "POST /challenges/:id/progress" "No challenge created"
    test_endpoint "GET" "/challenges/dummy/leaderboard" "$MANAGER_TOKEN" "" 404 "GET /challenges/:id/leaderboard" "No challenge created"
    test_endpoint "GET" "/challenges/dummy/analytics" "$MANAGER_TOKEN" "" 404 "GET /challenges/:id/analytics" "No challenge created"
    test_endpoint "PATCH" "/challenges/dummy/status" "$MANAGER_TOKEN" '{"status":"active"}' 404 "PATCH /challenges/:id/status" "No challenge created"
    test_endpoint "POST" "/challenges/dummy/leave" "$MANAGER_TOKEN" "" 404 "POST /challenges/:id/leave" "No challenge created"
    test_endpoint "DELETE" "/challenges/dummy" "$MANAGER_TOKEN" "" 404 "DELETE /challenges/:id" "No challenge created"
fi
echo ""

# =========================
# RESOURCE ROUTE TESTS - resourceRoutes.js
# =========================
echo -e "${CYAN}=== Resource Endpoints (resourceRoutes.js) ===${NC}"

test_endpoint "GET" "/resources/categories" "$MANAGER_TOKEN" "" 200 "GET /resources/categories (Manager)"
test_endpoint "GET" "/resources/featured" "$MANAGER_TOKEN" "" 200 "GET /resources/featured (Manager)"
test_endpoint "GET" "/resources/popular" "$MANAGER_TOKEN" "" 200 "GET /resources/popular (Manager)"
test_endpoint "GET" "/resources/my-history" "$MANAGER_TOKEN" "" 200 "GET /resources/my-history (Manager)"
test_endpoint "GET" "/resources/category/articles" "$MANAGER_TOKEN" "" 200 "GET /resources/category/:category (Manager)"
test_endpoint "GET" "/resources" "$MANAGER_TOKEN" "" 200 "GET /resources (Manager)"

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
test_endpoint "POST" "/resources" "$MANAGER_TOKEN" "$RESOURCE_DATA" 201 "POST /resources (Manager)"

if [ ! -z "$RESOURCE_ID" ]; then
    test_endpoint "GET" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" "" 200 "GET /resources/:id (Manager)"
    test_endpoint "PUT" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" '{"title":"Updated Resource Title"}' 200 "PUT /resources/:id (Manager)"
    test_endpoint "POST" "/resources/$RESOURCE_ID/interact" "$MANAGER_TOKEN" '{"action":"view"}' 200 "POST /resources/:id/interact (Manager)"
    test_endpoint "GET" "/resources/$RESOURCE_ID/analytics" "$MANAGER_TOKEN" "" 200 "GET /resources/:id/analytics (Manager)"
    test_endpoint "PATCH" "/resources/$RESOURCE_ID/status" "$MANAGER_TOKEN" '{"status":"inactive"}' 200 "PATCH /resources/:id/status (Manager)"
    test_endpoint "DELETE" "/resources/$RESOURCE_ID" "$MANAGER_TOKEN" "" 200 "DELETE /resources/:id (Manager)"
else
    test_endpoint "GET" "/resources/dummy" "$MANAGER_TOKEN" "" 404 "GET /resources/:id" "No resource created"
    test_endpoint "PUT" "/resources/dummy" "$MANAGER_TOKEN" '{"title":"test"}' 404 "PUT /resources/:id" "No resource created"
    test_endpoint "POST" "/resources/dummy/interact" "$MANAGER_TOKEN" '{"action":"view"}' 404 "POST /resources/:id/interact" "No resource created"
    test_endpoint "GET" "/resources/dummy/analytics" "$MANAGER_TOKEN" "" 404 "GET /resources/:id/analytics" "No resource created"
    test_endpoint "PATCH" "/resources/dummy/status" "$MANAGER_TOKEN" '{"status":"active"}' 404 "PATCH /resources/:id/status" "No resource created"
    test_endpoint "DELETE" "/resources/dummy" "$MANAGER_TOKEN" "" 404 "DELETE /resources/:id" "No resource created"
fi
echo ""

# =========================
# REWARD ROUTE TESTS - rewardRoutes.js
# =========================
echo -e "${CYAN}=== Reward Endpoints (rewardRoutes.js) ===${NC}"

# Basic reward endpoints (all authenticated users)
test_endpoint "GET" "/rewards/categories" "$MANAGER_TOKEN" "" 200 "GET /rewards/categories (Manager)"
test_endpoint "GET" "/rewards/featured" "$MANAGER_TOKEN" "" 200 "GET /rewards/featured (Manager)"
test_endpoint "GET" "/rewards/category/wellness" "$MANAGER_TOKEN" "" 200 "GET /rewards/category/:category (Manager)"
test_endpoint "GET" "/rewards" "$MANAGER_TOKEN" "" 200 "GET /rewards (Manager)"

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
test_endpoint "POST" "/rewards" "$HR_TOKEN" "$REWARD_DATA" 201 "POST /rewards (HR)"

if [ ! -z "$REWARD_ID" ]; then
    test_endpoint "GET" "/rewards/$REWARD_ID" "$MANAGER_TOKEN" "" 200 "GET /rewards/:id (Manager)"
    test_endpoint "PUT" "/rewards/$REWARD_ID" "$HR_TOKEN" '{"name":"Updated Spa Voucher"}' 200 "PUT /rewards/:id (HR)"
    test_endpoint "POST" "/rewards/$REWARD_ID/redeem" "$MANAGER_TOKEN" '{"fulfillment":{"method":"email","email":"test@example.com"}}' 400 "POST /rewards/:id/redeem (Manager)" "Insufficient coins expected"
    test_endpoint "DELETE" "/rewards/$REWARD_ID" "$HR_TOKEN" "" 200 "DELETE /rewards/:id (HR)"
else
    test_endpoint "GET" "/rewards/dummy" "$MANAGER_TOKEN" "" 404 "GET /rewards/:id" "No reward created"
    test_endpoint "PUT" "/rewards/dummy" "$HR_TOKEN" '{"name":"test"}' 404 "PUT /rewards/:id" "No reward created"
    test_endpoint "POST" "/rewards/dummy/redeem" "$MANAGER_TOKEN" '{}' 404 "POST /rewards/:id/redeem" "No reward created"
    test_endpoint "DELETE" "/rewards/dummy" "$HR_TOKEN" "" 404 "DELETE /rewards/:id" "No reward created"
fi

# Redemption endpoints
test_endpoint "GET" "/rewards/redemptions/my-redemptions" "$MANAGER_TOKEN" "" 200 "GET /rewards/redemptions/my-redemptions (Manager)"
test_endpoint "GET" "/rewards/redemptions/dummy" "$MANAGER_TOKEN" "" 404 "GET /rewards/redemptions/:id (Manager)"
test_endpoint "PATCH" "/rewards/redemptions/dummy/status" "$HR_TOKEN" '{"status":"approved"}' 404 "PATCH /rewards/redemptions/:id/status (HR)"
test_endpoint "POST" "/rewards/redemptions/dummy/rate" "$MANAGER_TOKEN" '{"score":5,"feedback":"Great"}' 404 "POST /rewards/redemptions/:id/rate (Manager)"

# Achievement endpoints
test_endpoint "GET" "/rewards/achievements/all" "$MANAGER_TOKEN" "" 200 "GET /rewards/achievements/all (Manager)"
test_endpoint "GET" "/rewards/achievements/my-achievements" "$MANAGER_TOKEN" "" 200 "GET /rewards/achievements/my-achievements (Manager)"

ACHIEVEMENT_DATA='{
  "name": "First Check-in Master",
  "description": "Complete your first daily check-in",
  "category": "milestone",
  "icon": "🎯",
  "criteria": {"type": "total_checkins", "value": 1},
  "happyCoinsReward": 50
}'
test_endpoint "POST" "/rewards/achievements" "$HR_TOKEN" "$ACHIEVEMENT_DATA" 201 "POST /rewards/achievements (HR)"

# Recognition endpoints 
if [ ! -z "$MANAGER_ID" ]; then
    RECOGNITION_DATA='{
      "toUserId": "'$MANAGER_ID'",
      "type": "kudos",
      "message": "Great job on the project!",
      "category": "collaboration"
    }'
    test_endpoint "POST" "/rewards/recognitions/send" "$HR_TOKEN" "$RECOGNITION_DATA" 201 "POST /rewards/recognitions/send (HR)"
else
    test_endpoint "POST" "/rewards/recognitions/send" "$HR_TOKEN" '{"toUserId":"dummy","type":"kudos","message":"test","category":"collaboration"}' 400 "POST /rewards/recognitions/send" "No manager ID"
fi

test_endpoint "GET" "/rewards/recognitions/my-recognitions" "$MANAGER_TOKEN" "" 200 "GET /rewards/recognitions/my-recognitions (Manager)"
test_endpoint "GET" "/rewards/recognitions/team" "$MANAGER_TOKEN" "" 200 "GET /rewards/recognitions/team (Manager)"
echo ""

# =========================
# WHATSAPP ROUTE TESTS - whatsapp.routes.js
# =========================
echo -e "${CYAN}=== WhatsApp Endpoints (whatsapp.routes.js) ===${NC}"

# Public webhook endpoints
test_endpoint "GET" "/whatsapp/webhook" "" "" 403 "GET /whatsapp/webhook (No params)"
test_endpoint "POST" "/whatsapp/webhook" "" '{"entry":[]}' 200 "POST /whatsapp/webhook"

# Protected endpoints
test_endpoint "GET" "/whatsapp/status" "$MANAGER_TOKEN" "" 200 "GET /whatsapp/status (Manager)"

# HR/Admin only endpoints
test_endpoint "POST" "/whatsapp/send-message" "$HR_TOKEN" '{"phoneNumber":"1234567890","message":"Test message"}' 200 "POST /whatsapp/send-message (HR)"

# Admin only endpoints
if [ ! -z "$MANAGER_ID" ]; then
    test_endpoint "POST" "/whatsapp/send-reminder" "$ADMIN_TOKEN" '{"userId":"'$MANAGER_ID'","reminderType":"daily_checkin"}' 200 "POST /whatsapp/send-reminder (Admin)"
else
    test_endpoint "POST" "/whatsapp/send-reminder" "$ADMIN_TOKEN" '{"userId":"dummy"}' 400 "POST /whatsapp/send-reminder" "No manager ID"
fi

test_endpoint "POST" "/whatsapp/send-report" "$ADMIN_TOKEN" '{"userId":"'$MANAGER_ID'","reportData":{}}' 200 "POST /whatsapp/send-report (Admin)"
test_endpoint "POST" "/whatsapp/test-template" "$ADMIN_TOKEN" '{"templateName":"check_in_reminder","phoneNumber":"1234567890"}' 200 "POST /whatsapp/test-template (Admin)"
echo ""

# =========================
# SUMMARY
# =========================
echo ""
echo "=============================================="
echo -e "${BLUE}COMPLETE TEST SUMMARY${NC}"
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
echo -e "${MAGENTA}Endpoints Tested by Route File:${NC}"
echo "----------------------------------------"
echo "• auth.routes.js: 9 endpoints"
echo "• checkin.routes.js: 6 endpoints"  
echo "• profile.routes.js: 5 endpoints"
echo "• onboarding.routes.js: 3 endpoints"
echo "• analytics.routes.js: 5 endpoints"
echo "• ai.routes.js: 6 endpoints"
echo "• surveyRoutes.js: 9 endpoints"
echo "• teamRoutes.js: 5 endpoints"
echo "• challengeRoutes.js: 13 endpoints"
echo "• resourceRoutes.js: 13 endpoints"
echo "• rewardRoutes.js: 19 endpoints"
echo "• whatsapp.routes.js: 7 endpoints"
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