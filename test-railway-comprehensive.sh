#!/bin/bash

# WellnessAI Backend - Comprehensive Railway Testing
# Tests ALL endpoints with exact paths from routes/index.js

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

# Test results storage
declare -A TEST_RESULTS

echo "=============================================="
echo "WellnessAI Backend - Comprehensive Testing"
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
    local skip_if_no_token=$7
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Skip if no token and flag is set
    if [ "$skip_if_no_token" = "true" ] && [ -z "$token" ]; then
        echo -e "${YELLOW}⚠${NC} $test_name - SKIPPED (No auth token)"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        TEST_RESULTS["$test_name"]="SKIPPED"
        return
    fi
    
    if [ "$method" = "GET" ]; then
        if [ -z "$token" ]; then
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" -H "Authorization: Bearer $token" "$BASE_URL$endpoint")
        fi
    elif [ "$method" = "POST" ]; then
        if [ -z "$token" ]; then
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$BASE_URL$endpoint")
        fi
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X DELETE -H "Authorization: Bearer $token" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $test_name (Status: $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS["$test_name"]="PASSED"
    else
        echo -e "${RED}✗${NC} $test_name (Expected: $expected_status, Got: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS["$test_name"]="FAILED"
        if [ "$8" = "verbose" ] || [ "$http_code" -ne "$expected_status" ]; then
            echo "   Response: $body" | jq . 2>/dev/null || echo "   Response: $body"
        fi
    fi
}

# Test API root
echo -e "${CYAN}=== API Documentation Endpoint ===${NC}"
test_endpoint "GET" "/" "" "" 200 "API Documentation"
echo ""

# Test health endpoint
echo -e "${CYAN}=== Health Check ===${NC}"
response=$(curl -s "$BASE_URL/../health")
echo "$response" | jq .
echo ""

# Setup test users
echo -e "${CYAN}=== Setting Up Test Users ===${NC}"

# Employee
EMPLOYEE_DATA='{
  "employeeId": "EMP'$TIMESTAMP'",
  "email": "employee'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test Employee",
  "department": "Engineering"
}'

# Manager
MANAGER_DATA='{
  "employeeId": "MGR'$TIMESTAMP'",
  "email": "manager'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test Manager",
  "department": "Engineering",
  "role": "manager"
}'

# HR
HR_DATA='{
  "employeeId": "HR'$TIMESTAMP'",
  "email": "hr'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test HR",
  "department": "HR",
  "role": "hr"
}'

# Admin
ADMIN_DATA='{
  "employeeId": "ADM'$TIMESTAMP'",
  "email": "admin'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test Admin",
  "department": "Engineering",
  "role": "admin"
}'

# Register all users
echo -e "${YELLOW}Registering test users...${NC}"
test_endpoint "POST" "/auth/register" "" "$EMPLOYEE_DATA" 201 "Register Employee"
test_endpoint "POST" "/auth/register" "" "$MANAGER_DATA" 201 "Register Manager"
test_endpoint "POST" "/auth/register" "" "$HR_DATA" 201 "Register HR"
test_endpoint "POST" "/auth/register" "" "$ADMIN_DATA" 201 "Register Admin"
echo ""

# Login all users and get tokens
echo -e "${YELLOW}Logging in test users...${NC}"
response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"employee'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' "$BASE_URL/auth/login")
EMPLOYEE_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
EMPLOYEE_ID=$(echo $response | jq -r '.data.user._id // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' 200 "Login Employee"

response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"manager'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' "$BASE_URL/auth/login")
MANAGER_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"manager'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' 200 "Login Manager"

response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"hr'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' "$BASE_URL/auth/login")
HR_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"hr'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' 200 "Login HR"

response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"admin'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' "$BASE_URL/auth/login")
ADMIN_TOKEN=$(echo $response | jq -r '.data.accessToken // empty')
test_endpoint "POST" "/auth/login" "" '{"email":"admin'$TIMESTAMP'@wellnessai.com","password":"Test123456"}' 200 "Login Admin"
echo ""

# Test Authentication Endpoints
echo -e "${CYAN}=== Authentication Endpoints ===${NC}"
test_endpoint "GET" "/auth/profile" "$EMPLOYEE_TOKEN" "" 200 "Get Profile" true
test_endpoint "POST" "/auth/refresh" "$EMPLOYEE_TOKEN" '{"refreshToken":"dummy"}' 401 "Refresh Token" true
test_endpoint "POST" "/auth/resend-verification" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "Resend Verification"
test_endpoint "POST" "/auth/forgot-password" "" '{"email":"employee'$TIMESTAMP'@wellnessai.com"}' 200 "Forgot Password"
test_endpoint "POST" "/auth/change-password" "$EMPLOYEE_TOKEN" '{"currentPassword":"Test123456","newPassword":"Test654321"}' 200 "Change Password" true
test_endpoint "POST" "/auth/logout" "$EMPLOYEE_TOKEN" "" 200 "Logout" true
echo ""

# Test Check-in Endpoints
echo -e "${CYAN}=== Check-in Endpoints ===${NC}"
CHECKIN_DATA='{
  "mood": 4,
  "energyLevel": 4,
  "stressLevel": 2,
  "sleepQuality": 4,
  "workload": 3,
  "comment": "Feeling good",
  "activities": ["exercise", "meditation"]
}'
test_endpoint "POST" "/checkins" "$EMPLOYEE_TOKEN" "$CHECKIN_DATA" 201 "Create Check-in" true
test_endpoint "GET" "/checkins" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in History" true
test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "Get Today's Check-in" true
test_endpoint "GET" "/checkins/trend" "$EMPLOYEE_TOKEN" "" 200 "Get Mood Trend" true
test_endpoint "GET" "/checkins/stats" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in Stats" true

# Get check-in ID for update/delete tests
response=$(curl -s -H "Authorization: Bearer $EMPLOYEE_TOKEN" "$BASE_URL/checkins/today")
CHECKIN_ID=$(echo $response | jq -r '.data.checkIn._id // empty')
if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "PUT" "/checkins/$CHECKIN_ID" "$EMPLOYEE_TOKEN" '{"feedback":"Updated feedback"}' 200 "Update Check-in" true
else
    echo -e "${YELLOW}⚠${NC} Update Check-in - SKIPPED (No check-in ID)"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi
echo ""

# Test Profile Endpoints
echo -e "${CYAN}=== Profile Endpoints ===${NC}"
test_endpoint "PUT" "/profile" "$EMPLOYEE_TOKEN" '{"name":"Updated Name"}' 200 "Update Profile" true
test_endpoint "PUT" "/profile/preferences" "$EMPLOYEE_TOKEN" '{"notifications":{"checkInReminder":false}}' 200 "Update Preferences" true
test_endpoint "GET" "/profile/wellness-stats" "$EMPLOYEE_TOKEN" "" 200 "Get Wellness Stats" true
echo ""

# Test Onboarding Endpoints
echo -e "${CYAN}=== Onboarding Endpoints ===${NC}"
test_endpoint "GET" "/onboarding/questionnaire" "$EMPLOYEE_TOKEN" "" 200 "Get Questionnaire" true
test_endpoint "GET" "/onboarding/status" "$EMPLOYEE_TOKEN" "" 200 "Get Onboarding Status" true
ONBOARDING_DATA='{
  "responses": {
    "interests": ["fitness", "meditation"],
    "stressors": ["workload", "deadlines"],
    "preferredSupport": ["articles", "videos"]
  }
}'
test_endpoint "POST" "/onboarding/submit" "$EMPLOYEE_TOKEN" "$ONBOARDING_DATA" 200 "Submit Onboarding" true
echo ""

# Test Analytics Endpoints (HR/Admin only)
echo -e "${CYAN}=== Analytics Endpoints ===${NC}"
test_endpoint "GET" "/analytics/company-overview" "$HR_TOKEN" "" 200 "Company Overview (HR)" true
test_endpoint "GET" "/analytics/department/Engineering" "$HR_TOKEN" "" 200 "Department Analytics (HR)" true
test_endpoint "GET" "/analytics/risk-assessment" "$HR_TOKEN" "" 200 "Risk Assessment (HR)" true
test_endpoint "GET" "/analytics/engagement" "$HR_TOKEN" "" 200 "Engagement Metrics (HR)" true
test_endpoint "GET" "/analytics/export?format=json" "$ADMIN_TOKEN" "" 200 "Export Analytics (Admin)" true
echo ""

# Test AI Endpoints
echo -e "${CYAN}=== AI Endpoints ===${NC}"
test_endpoint "GET" "/ai/test" "$EMPLOYEE_TOKEN" "" 200 "Test AI Service" true
test_endpoint "GET" "/ai/insights" "$EMPLOYEE_TOKEN" "" 200 "Get AI Insights" true
test_endpoint "GET" "/ai/summary/weekly" "$EMPLOYEE_TOKEN" "" 200 "Weekly AI Summary" true
test_endpoint "GET" "/ai/status" "$EMPLOYEE_TOKEN" "" 200 "AI Service Status" true
if [ ! -z "$CHECKIN_ID" ]; then
    test_endpoint "GET" "/ai/analyze/$CHECKIN_ID" "$EMPLOYEE_TOKEN" "" 200 "Analyze Check-in" true
fi
if [ ! -z "$EMPLOYEE_ID" ]; then
    test_endpoint "GET" "/ai/risk-assessment/$EMPLOYEE_ID" "$HR_TOKEN" "" 200 "AI Risk Assessment (HR)" true
fi
echo ""

# Test Survey Endpoints
echo -e "${CYAN}=== Survey Endpoints ===${NC}"
test_endpoint "GET" "/surveys/templates" "$EMPLOYEE_TOKEN" "" 200 "Get Survey Templates" true
test_endpoint "GET" "/surveys/active" "$EMPLOYEE_TOKEN" "" 200 "Get Active Surveys" true
test_endpoint "GET" "/surveys" "$EMPLOYEE_TOKEN" "" 200 "Get All Surveys" true

# Create a survey as HR
SURVEY_DATA='{
  "title": "Test Survey",
  "description": "Testing survey functionality",
  "type": "pulse",
  "questions": [{
    "text": "How are you feeling?",
    "type": "rating",
    "required": true,
    "options": {"min": 1, "max": 5}
  }],
  "targetAudience": {"departments": ["Engineering"]},
  "schedule": {"frequency": "once"}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $HR_TOKEN" -d "$SURVEY_DATA" "$BASE_URL/surveys")
SURVEY_ID=$(echo $response | jq -r '.data.survey._id // empty')
test_endpoint "POST" "/surveys" "$HR_TOKEN" "$SURVEY_DATA" 201 "Create Survey (HR)" true

if [ ! -z "$SURVEY_ID" ]; then
    test_endpoint "GET" "/surveys/$SURVEY_ID" "$EMPLOYEE_TOKEN" "" 200 "Get Survey Details" true
    test_endpoint "PUT" "/surveys/$SURVEY_ID" "$HR_TOKEN" '{"title":"Updated Survey"}' 200 "Update Survey (HR)" true
    test_endpoint "POST" "/surveys/$SURVEY_ID/respond" "$EMPLOYEE_TOKEN" '{"responses":[{"questionId":"q1","value":4}]}' 200 "Submit Survey Response" true
    test_endpoint "GET" "/surveys/$SURVEY_ID/analytics" "$HR_TOKEN" "" 200 "Get Survey Analytics (HR)" true
    test_endpoint "PATCH" "/surveys/$SURVEY_ID/status" "$HR_TOKEN" '{"status":"completed"}' 200 "Update Survey Status (HR)" true
fi
echo ""

# Test Team Endpoints
echo -e "${CYAN}=== Team Endpoints ===${NC}"
test_endpoint "GET" "/team/overview" "$MANAGER_TOKEN" "" 200 "Team Overview (Manager)" true
test_endpoint "GET" "/team/mood-trend" "$MANAGER_TOKEN" "" 200 "Team Mood Trend (Manager)" true
test_endpoint "GET" "/team/risk-assessment" "$MANAGER_TOKEN" "" 200 "Team Risk Assessment (Manager)" true
test_endpoint "GET" "/team/survey-participation" "$MANAGER_TOKEN" "" 200 "Team Survey Participation (Manager)" true
test_endpoint "GET" "/team/engagement" "$MANAGER_TOKEN" "" 200 "Team Engagement (Manager)" true
echo ""

# Test Challenge Endpoints
echo -e "${CYAN}=== Challenge Endpoints ===${NC}"
test_endpoint "GET" "/challenges/templates" "$EMPLOYEE_TOKEN" "" 200 "Get Challenge Templates" true
test_endpoint "GET" "/challenges/active" "$EMPLOYEE_TOKEN" "" 200 "Get Active Challenges" true
test_endpoint "GET" "/challenges/my-challenges" "$EMPLOYEE_TOKEN" "" 200 "Get My Challenges" true
test_endpoint "GET" "/challenges" "$EMPLOYEE_TOKEN" "" 200 "Get All Challenges" true

# Create a challenge as Manager
CHALLENGE_DATA='{
  "title": "Step Challenge",
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
test_endpoint "POST" "/challenges" "$MANAGER_TOKEN" "$CHALLENGE_DATA" 201 "Create Challenge (Manager)" true

if [ ! -z "$CHALLENGE_ID" ]; then
    test_endpoint "GET" "/challenges/$CHALLENGE_ID" "$EMPLOYEE_TOKEN" "" 200 "Get Challenge Details" true
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/join" "$EMPLOYEE_TOKEN" "" 200 "Join Challenge" true
    test_endpoint "POST" "/challenges/$CHALLENGE_ID/progress" "$EMPLOYEE_TOKEN" '{"value":5000}' 200 "Update Progress" true
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/leaderboard" "$EMPLOYEE_TOKEN" "" 200 "Get Leaderboard" true
    test_endpoint "GET" "/challenges/$CHALLENGE_ID/analytics" "$MANAGER_TOKEN" "" 200 "Challenge Analytics (Manager)" true
fi
echo ""

# Test Resource Endpoints
echo -e "${CYAN}=== Resource Endpoints ===${NC}"
test_endpoint "GET" "/resources/categories" "$EMPLOYEE_TOKEN" "" 200 "Get Resource Categories" true
test_endpoint "GET" "/resources/featured" "$EMPLOYEE_TOKEN" "" 200 "Get Featured Resources" true
test_endpoint "GET" "/resources/popular" "$EMPLOYEE_TOKEN" "" 200 "Get Popular Resources" true
test_endpoint "GET" "/resources/my-history" "$EMPLOYEE_TOKEN" "" 200 "Get My Resource History" true
test_endpoint "GET" "/resources/category/articles" "$EMPLOYEE_TOKEN" "" 200 "Get Resources by Category" true
test_endpoint "GET" "/resources" "$EMPLOYEE_TOKEN" "" 200 "Get All Resources" true

# Create a resource as HR
RESOURCE_DATA='{
  "title": "Stress Management Guide",
  "description": "Learn to manage workplace stress",
  "type": "article",
  "category": "mental-health",
  "content": {"body": "Article content here"},
  "tags": ["stress", "wellness"]
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $HR_TOKEN" -d "$RESOURCE_DATA" "$BASE_URL/resources")
RESOURCE_ID=$(echo $response | jq -r '.data.resource._id // empty')
test_endpoint "POST" "/resources" "$HR_TOKEN" "$RESOURCE_DATA" 201 "Create Resource (HR)" true

if [ ! -z "$RESOURCE_ID" ]; then
    test_endpoint "GET" "/resources/$RESOURCE_ID" "$EMPLOYEE_TOKEN" "" 200 "Get Resource Details" true
    test_endpoint "POST" "/resources/$RESOURCE_ID/interact" "$EMPLOYEE_TOKEN" '{"action":"view"}' 200 "Interact with Resource" true
    test_endpoint "GET" "/resources/$RESOURCE_ID/analytics" "$HR_TOKEN" "" 200 "Resource Analytics (HR)" true
fi
echo ""

# Test Reward Endpoints
echo -e "${CYAN}=== Reward Endpoints ===${NC}"
test_endpoint "GET" "/rewards/categories" "$EMPLOYEE_TOKEN" "" 200 "Get Reward Categories" true
test_endpoint "GET" "/rewards/featured" "$EMPLOYEE_TOKEN" "" 200 "Get Featured Rewards" true
test_endpoint "GET" "/rewards/category/wellness" "$EMPLOYEE_TOKEN" "" 200 "Get Rewards by Category" true
test_endpoint "GET" "/rewards" "$EMPLOYEE_TOKEN" "" 200 "Get All Rewards" true

# Create a reward as Admin
REWARD_DATA='{
  "name": "Spa Voucher",
  "description": "Relaxing spa treatment",
  "category": "wellness",
  "type": "voucher",
  "cost": 500,
  "value": 100,
  "availability": {"quantity": 10, "isActive": true}
}'
response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "$REWARD_DATA" "$BASE_URL/rewards")
REWARD_ID=$(echo $response | jq -r '.data.reward._id // empty')
test_endpoint "POST" "/rewards" "$ADMIN_TOKEN" "$REWARD_DATA" 201 "Create Reward (Admin)" true

if [ ! -z "$REWARD_ID" ]; then
    test_endpoint "GET" "/rewards/$REWARD_ID" "$EMPLOYEE_TOKEN" "" 200 "Get Reward Details" true
fi

# Test achievement endpoints
test_endpoint "GET" "/rewards/achievements/all" "$EMPLOYEE_TOKEN" "" 200 "Get All Achievements" true
test_endpoint "GET" "/rewards/achievements/my-achievements" "$EMPLOYEE_TOKEN" "" 200 "Get My Achievements" true

# Create achievement as Admin
ACHIEVEMENT_DATA='{
  "name": "First Check-in",
  "description": "Complete your first check-in",
  "category": "milestone",
  "icon": "🎯",
  "criteria": {"type": "total_checkins", "value": 1},
  "happyCoinsReward": 50
}'
test_endpoint "POST" "/rewards/achievements" "$ADMIN_TOKEN" "$ACHIEVEMENT_DATA" 201 "Create Achievement (Admin)" true

# Test recognition endpoints
RECOGNITION_DATA='{
  "toUserId": "'$EMPLOYEE_ID'",
  "type": "kudos",
  "message": "Great work!",
  "category": "collaboration"
}'
test_endpoint "POST" "/rewards/recognitions/send" "$MANAGER_TOKEN" "$RECOGNITION_DATA" 201 "Send Recognition" true
test_endpoint "GET" "/rewards/recognitions/my-recognitions" "$EMPLOYEE_TOKEN" "" 200 "Get My Recognitions" true
test_endpoint "GET" "/rewards/recognitions/team" "$MANAGER_TOKEN" "" 200 "Get Team Recognitions" true

# Test redemption endpoints
test_endpoint "GET" "/rewards/redemptions/my-redemptions" "$EMPLOYEE_TOKEN" "" 200 "Get My Redemptions" true
echo ""

# Test WhatsApp Endpoints
echo -e "${CYAN}=== WhatsApp Endpoints ===${NC}"
test_endpoint "GET" "/whatsapp/status" "$EMPLOYEE_TOKEN" "" 200 "WhatsApp Service Status" true
test_endpoint "POST" "/whatsapp/send-message" "$HR_TOKEN" '{"to":"1234567890","message":"Test"}' 200 "Send WhatsApp Message (HR)" true
test_endpoint "POST" "/whatsapp/send-reminder" "$ADMIN_TOKEN" '{"userId":"'$EMPLOYEE_ID'"}' 200 "Send Reminder (Admin)" true
echo ""

# Summary
echo ""
echo "=============================================="
echo -e "${BLUE}COMPREHENSIVE TEST SUMMARY${NC}"
echo "=============================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"
echo ""

# Calculate percentages
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo -e "Pass Rate: ${GREEN}${PASS_RATE}%${NC}"
fi

echo ""
echo -e "${MAGENTA}Test Results by Category:${NC}"
echo "----------------------------------------"

# Group results by endpoint category
declare -A CATEGORY_STATS

for test_name in "${!TEST_RESULTS[@]}"; do
    result="${TEST_RESULTS[$test_name]}"
    
    # Determine category
    if [[ $test_name == *"Auth"* ]] || [[ $test_name == *"Login"* ]] || [[ $test_name == *"Register"* ]]; then
        category="Authentication"
    elif [[ $test_name == *"Check-in"* ]]; then
        category="Check-ins"
    elif [[ $test_name == *"Profile"* ]]; then
        category="Profile"
    elif [[ $test_name == *"Onboarding"* ]]; then
        category="Onboarding"
    elif [[ $test_name == *"Analytics"* ]] || [[ $test_name == *"Overview"* ]]; then
        category="Analytics"
    elif [[ $test_name == *"AI"* ]]; then
        category="AI"
    elif [[ $test_name == *"Survey"* ]]; then
        category="Surveys"
    elif [[ $test_name == *"Team"* ]]; then
        category="Team"
    elif [[ $test_name == *"Challenge"* ]]; then
        category="Challenges"
    elif [[ $test_name == *"Resource"* ]]; then
        category="Resources"
    elif [[ $test_name == *"Reward"* ]] || [[ $test_name == *"Achievement"* ]] || [[ $test_name == *"Recognition"* ]]; then
        category="Rewards"
    elif [[ $test_name == *"WhatsApp"* ]]; then
        category="WhatsApp"
    else
        category="Other"
    fi
    
    # Update category stats
    if [ "$result" = "PASSED" ]; then
        CATEGORY_STATS["${category}_passed"]=$((${CATEGORY_STATS["${category}_passed"]:-0} + 1))
    elif [ "$result" = "FAILED" ]; then
        CATEGORY_STATS["${category}_failed"]=$((${CATEGORY_STATS["${category}_failed"]:-0} + 1))
    elif [ "$result" = "SKIPPED" ]; then
        CATEGORY_STATS["${category}_skipped"]=$((${CATEGORY_STATS["${category}_skipped"]:-0} + 1))
    fi
    CATEGORY_STATS["${category}_total"]=$((${CATEGORY_STATS["${category}_total"]:-0} + 1))
done

# Print category stats
for category in "Authentication" "Check-ins" "Profile" "Onboarding" "Analytics" "AI" "Surveys" "Team" "Challenges" "Resources" "Rewards" "WhatsApp" "Other"; do
    total=${CATEGORY_STATS["${category}_total"]:-0}
    if [ $total -gt 0 ]; then
        passed=${CATEGORY_STATS["${category}_passed"]:-0}
        failed=${CATEGORY_STATS["${category}_failed"]:-0}
        skipped=${CATEGORY_STATS["${category}_skipped"]:-0}
        
        echo -e "${CYAN}$category:${NC} Total: $total, Passed: ${GREEN}$passed${NC}, Failed: ${RED}$failed${NC}, Skipped: ${YELLOW}$skipped${NC}"
    fi
done

echo ""
if [ $FAILED_TESTS -eq 0 ] && [ $SKIPPED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
elif [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  All active tests passed, but some were skipped${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed! Review the results above.${NC}"
    exit 1
fi