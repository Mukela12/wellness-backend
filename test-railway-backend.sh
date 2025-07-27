#!/bin/bash

# WellnessAI Backend - Railway Production Testing
# Tests all endpoints on the deployed Railway backend

BASE_URL="https://wellness-backend-production-48b1.up.railway.app/api"
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
echo "WellnessAI Backend - Railway Testing"
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
        echo -e "${GREEN}✓${NC} $test_name (Status: $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        if [ "$7" = "verbose" ]; then
            echo "   Response: $body" | jq . 2>/dev/null || echo "   Response: $body"
        fi
    else
        echo -e "${RED}✗${NC} $test_name (Expected: $expected_status, Got: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "   Response: $body" | jq . 2>/dev/null || echo "   Response: $body"
    fi
    
    echo ""
}

# Test health endpoint
echo -e "${BLUE}Testing Health Endpoint${NC}"
echo "----------------------------------------"
curl -s "$BASE_URL/../health" | jq .
echo ""

# Test Employee Flow
echo -e "${BLUE}Testing Employee User Flow${NC}"
echo "----------------------------------------"

# 1. Register Employee
echo -e "${YELLOW}1. Register Employee${NC}"
EMPLOYEE_DATA='{
  "employeeId": "EMP'$TIMESTAMP'",
  "email": "employee'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test Employee",
  "department": "Engineering"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$EMPLOYEE_DATA" "$BASE_URL/auth/register")
echo "Registration Response:"
echo $response | jq .
echo ""

# 2. Login Employee
echo -e "${YELLOW}2. Login Employee${NC}"
LOGIN_DATA='{
  "email": "employee'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$LOGIN_DATA" "$BASE_URL/auth/login")
EMPLOYEE_TOKEN=$(echo $response | jq -r '.data.accessToken')
echo "Login Response:"
echo $response | jq .
echo "Token: $EMPLOYEE_TOKEN"
echo ""

# 3. Test Employee Endpoints
echo -e "${YELLOW}3. Testing Employee Endpoints${NC}"

# Get Profile
test_endpoint "GET" "/auth/profile" "$EMPLOYEE_TOKEN" "" 200 "Get Profile"

# Submit Check-in
CHECKIN_DATA='{
  "mood": 4,
  "energyLevel": 4,
  "stressLevel": 2,
  "sleepQuality": 5,
  "workload": 3,
  "comment": "Feeling productive today",
  "activities": ["exercise", "meditation"]
}'
test_endpoint "POST" "/checkins" "$EMPLOYEE_TOKEN" "$CHECKIN_DATA" 201 "Submit Check-in"

# Get Check-in History
test_endpoint "GET" "/checkins" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in History"

# Get Today's Check-in
test_endpoint "GET" "/checkins/today" "$EMPLOYEE_TOKEN" "" 200 "Get Today's Check-in"

# Get Check-in Analytics
test_endpoint "GET" "/checkins/analytics" "$EMPLOYEE_TOKEN" "" 200 "Get Check-in Analytics"

# Get Rewards
test_endpoint "GET" "/rewards" "$EMPLOYEE_TOKEN" "" 200 "Get Available Rewards"

# Get User Achievements
test_endpoint "GET" "/achievements/user" "$EMPLOYEE_TOKEN" "" 200 "Get User Achievements"

# Test HR Flow
echo -e "${BLUE}Testing HR User Flow${NC}"
echo "----------------------------------------"

# 1. Register HR User
echo -e "${YELLOW}1. Register HR User${NC}"
HR_DATA='{
  "employeeId": "HR'$TIMESTAMP'",
  "email": "hr'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test HR Manager",
  "department": "Human Resources",
  "role": "hr"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$HR_DATA" "$BASE_URL/auth/register")
echo "HR Registration Response:"
echo $response | jq .
echo ""

# 2. Login HR
echo -e "${YELLOW}2. Login HR${NC}"
HR_LOGIN_DATA='{
  "email": "hr'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$HR_LOGIN_DATA" "$BASE_URL/auth/login")
HR_TOKEN=$(echo $response | jq -r '.data.accessToken')
echo "HR Login Response:"
echo $response | jq .
echo ""

# 3. Test HR Endpoints
echo -e "${YELLOW}3. Testing HR Endpoints${NC}"

# Get Team Analytics
test_endpoint "GET" "/analytics/overview" "$HR_TOKEN" "" 200 "Get Analytics Overview"
test_endpoint "GET" "/analytics/trends" "$HR_TOKEN" "" 200 "Get Trends"
test_endpoint "GET" "/analytics/departments" "$HR_TOKEN" "" 200 "Get Department Analytics"

# Test Admin Flow
echo -e "${BLUE}Testing Admin User Flow${NC}"
echo "----------------------------------------"

# 1. Register Admin User
echo -e "${YELLOW}1. Register Admin User${NC}"
ADMIN_DATA='{
  "employeeId": "ADMIN'$TIMESTAMP'",
  "email": "admin'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456",
  "name": "Test Admin",
  "department": "IT",
  "role": "admin"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$ADMIN_DATA" "$BASE_URL/auth/register")
echo "Admin Registration Response:"
echo $response | jq .
echo ""

# 2. Login Admin
echo -e "${YELLOW}2. Login Admin${NC}"
ADMIN_LOGIN_DATA='{
  "email": "admin'$TIMESTAMP'@wellnessai.com",
  "password": "Test123456"
}'

response=$(curl -s -X POST -H "Content-Type: application/json" -d "$ADMIN_LOGIN_DATA" "$BASE_URL/auth/login")
ADMIN_TOKEN=$(echo $response | jq -r '.data.accessToken')
echo "Admin Login Response:"
echo $response | jq .
echo ""

# 3. Test Admin Endpoints
echo -e "${YELLOW}3. Testing Admin Endpoints${NC}"

# Create a Reward (Admin only)
REWARD_DATA='{
  "name": "Spa Day Voucher",
  "description": "Relaxing spa treatment at local wellness center",
  "category": "wellness",
  "type": "voucher",
  "cost": 500,
  "value": 100,
  "availability": {
    "quantity": 10,
    "isActive": true
  }
}'
test_endpoint "POST" "/rewards" "$ADMIN_TOKEN" "$REWARD_DATA" 201 "Create Reward (Admin)"

# Summary
echo "=============================================="
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "=============================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi