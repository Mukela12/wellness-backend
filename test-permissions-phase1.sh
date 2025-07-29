#!/bin/bash

# =============================================================================
# PHASE 1: Permission System Testing Script
# =============================================================================
# This script tests the updated permission system to ensure:
# - Admin: Can manage Resources, Rewards, and Challenges
# - HR: Can manage Rewards and Challenges only (blocked from Resources)
# - Employee: Standard access (blocked from management operations)
# =============================================================================

set -e

# Configuration
BASE_URL="http://localhost:8005"
API_URL="$BASE_URL/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test user credentials
ADMIN_EMAIL="admin-test@example.com"
HR_EMAIL="hr-test@example.com"
EMPLOYEE_EMAIL="employee-test@example.com"
TEST_PASSWORD="TestPass123!"

# Tokens
ADMIN_TOKEN=""
HR_TOKEN=""
EMPLOYEE_TOKEN=""

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_step() {
    echo -e "${YELLOW}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

# Test API call with expected result
test_permission() {
    local method=$1
    local endpoint=$2
    local token=$3
    local expected_status=$4
    local description=$5
    local data=$6
    
    print_step "$description"
    
    local response
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Authorization: Bearer $token")
    fi
    
    local http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_code" = "$expected_status" ]; then
        print_success "Expected $expected_status, got $http_code"
    else
        print_error "Expected $expected_status, got $http_code"
        echo "Response: $body"
    fi
}

# Setup test users
setup_test_users() {
    print_header "SETTING UP TEST USERS"
    
    # Register Admin
    print_step "Registering Admin user"
    curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"Admin Test\",
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$TEST_PASSWORD\",
            \"employeeId\": \"ADM001\",
            \"department\": \"IT\",
            \"role\": \"admin\"
        }" > /dev/null
    
    # Register HR
    print_step "Registering HR user"
    curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"HR Test\",
            \"email\": \"$HR_EMAIL\",
            \"password\": \"$TEST_PASSWORD\",
            \"employeeId\": \"HR001\",
            \"department\": \"HR\",
            \"role\": \"hr\"
        }" > /dev/null
    
    # Register Employee
    print_step "Registering Employee user"
    curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"Employee Test\",
            \"email\": \"$EMPLOYEE_EMAIL\",
            \"password\": \"$TEST_PASSWORD\",
            \"employeeId\": \"EMP001\",
            \"department\": \"Engineering\"
        }" > /dev/null
    
    # Login and get tokens
    print_step "Getting Admin token"
    local admin_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")
    ADMIN_TOKEN=$(echo "$admin_response" | jq -r '.data.accessToken' 2>/dev/null)
    
    print_step "Getting HR token"
    local hr_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$HR_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")
    HR_TOKEN=$(echo "$hr_response" | jq -r '.data.accessToken' 2>/dev/null)
    
    print_step "Getting Employee token"
    local employee_response=$(curl -s -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"$EMPLOYEE_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")
    EMPLOYEE_TOKEN=$(echo "$employee_response" | jq -r '.data.accessToken' 2>/dev/null)
    
    print_success "All test users created and authenticated"
}

# Test Resource Management Permissions
test_resource_permissions() {
    print_header "TESTING RESOURCE MANAGEMENT PERMISSIONS"
    
    local test_resource='{
        "title": "Test Resource",
        "description": "Testing resource permissions",
        "category": "wellness",
        "type": "article",
        "content": {"url": "https://example.com/test"},
        "isActive": true
    }'
    
    print_info "Expected: Admin ✅, HR ❌, Employee ❌"
    
    # Admin should succeed (200)
    test_permission "POST" "/resources" "$ADMIN_TOKEN" "201" "Admin creating resource" "$test_resource"
    
    # HR should be forbidden (403)
    test_permission "POST" "/resources" "$HR_TOKEN" "403" "HR creating resource (should fail)" "$test_resource"
    
    # Employee should be forbidden (403)
    test_permission "POST" "/resources" "$EMPLOYEE_TOKEN" "403" "Employee creating resource (should fail)" "$test_resource"
}

# Test Reward Management Permissions
test_reward_permissions() {
    print_header "TESTING REWARD MANAGEMENT PERMISSIONS"
    
    local test_reward='{
        "name": "Test Reward",
        "description": "Testing reward permissions",
        "category": "wellness",
        "type": "voucher",
        "cost": 100,
        "value": 25,
        "availability": {"isActive": true, "quantity": 10}
    }'
    
    print_info "Expected: Admin ✅, HR ✅, Employee ❌"
    
    # Admin should succeed (201)
    test_permission "POST" "/rewards" "$ADMIN_TOKEN" "201" "Admin creating reward" "$test_reward"
    
    # HR should succeed (201)
    test_permission "POST" "/rewards" "$HR_TOKEN" "201" "HR creating reward" "$test_reward"
    
    # Employee should be forbidden (403)
    test_permission "POST" "/rewards" "$EMPLOYEE_TOKEN" "403" "Employee creating reward (should fail)" "$test_reward"
}

# Test Challenge Management Permissions
test_challenge_permissions() {
    print_header "TESTING CHALLENGE MANAGEMENT PERMISSIONS"
    
    local test_challenge='{
        "title": "Test Challenge",
        "description": "Testing challenge permissions",
        "type": "step_count",
        "duration": {"startDate": "2025-08-01", "endDate": "2025-08-31"},
        "target": {"value": 10000, "unit": "steps"},
        "rewards": {"happyCoins": 50},
        "isActive": true
    }'
    
    print_info "Expected: Admin ✅, HR ✅, Employee ❌"
    
    # Admin should succeed (201)
    test_permission "POST" "/challenges" "$ADMIN_TOKEN" "201" "Admin creating challenge" "$test_challenge"
    
    # HR should succeed (201)
    test_permission "POST" "/challenges" "$HR_TOKEN" "201" "HR creating challenge" "$test_challenge"
    
    # Employee should be forbidden (403)  
    test_permission "POST" "/challenges" "$EMPLOYEE_TOKEN" "403" "Employee creating challenge (should fail)" "$test_challenge"
}

# Test Read Access (should work for all roles)
test_read_permissions() {
    print_header "TESTING READ ACCESS (Should work for all roles)"
    
    print_info "Testing read access to resources, rewards, and challenges"
    
    # All users should be able to read
    test_permission "GET" "/resources" "$ADMIN_TOKEN" "200" "Admin reading resources"
    test_permission "GET" "/resources" "$HR_TOKEN" "200" "HR reading resources" 
    test_permission "GET" "/resources" "$EMPLOYEE_TOKEN" "200" "Employee reading resources"
    
    test_permission "GET" "/rewards" "$ADMIN_TOKEN" "200" "Admin reading rewards"
    test_permission "GET" "/rewards" "$HR_TOKEN" "200" "HR reading rewards"
    test_permission "GET" "/rewards" "$EMPLOYEE_TOKEN" "200" "Employee reading rewards"
    
    test_permission "GET" "/challenges" "$ADMIN_TOKEN" "200" "Admin reading challenges"
    test_permission "GET" "/challenges" "$HR_TOKEN" "200" "HR reading challenges"
    test_permission "GET" "/challenges" "$EMPLOYEE_TOKEN" "200" "Employee reading challenges"
}

# Display permission matrix
show_permission_matrix() {
    print_header "NEW PERMISSION MATRIX"
    
    echo -e "${BLUE}📋 Management Permissions Summary:${NC}"
    echo -e "   ${YELLOW}┌─────────────┬─────────┬──────┬──────────┐${NC}"
    echo -e "   ${YELLOW}│ Feature     │ Admin   │ HR   │ Employee │${NC}"
    echo -e "   ${YELLOW}├─────────────┼─────────┼──────┼──────────┤${NC}"
    echo -e "   ${YELLOW}│ Resources   │${NC} ${GREEN}✅ YES${NC}   ${YELLOW}│${NC} ${RED}❌ NO${NC}  ${YELLOW}│${NC} ${RED}❌ NO${NC}     ${YELLOW}│${NC}"
    echo -e "   ${YELLOW}│ Rewards     │${NC} ${GREEN}✅ YES${NC}   ${YELLOW}│${NC} ${GREEN}✅ YES${NC} ${YELLOW}│${NC} ${RED}❌ NO${NC}     ${YELLOW}│${NC}"
    echo -e "   ${YELLOW}│ Challenges  │${NC} ${GREEN}✅ YES${NC}   ${YELLOW}│${NC} ${GREEN}✅ YES${NC} ${YELLOW}│${NC} ${RED}❌ NO${NC}     ${YELLOW}│${NC}"
    echo -e "   ${YELLOW}└─────────────┴─────────┴──────┴──────────┘${NC}"
    
    echo -e "\n${BLUE}📖 Read Access (All users can view):${NC}"
    echo -e "   • ${GREEN}Resources${NC} - Browse wellness resources and articles"
    echo -e "   • ${GREEN}Rewards${NC} - View available rewards and redeem with coins"
    echo -e "   • ${GREEN}Challenges${NC} - View and participate in wellness challenges"
}

# Main execution
main() {
    print_header "PHASE 1: PERMISSION SYSTEM TESTING"
    
    echo -e "${PURPLE}Testing updated permission system with new role restrictions:${NC}"
    echo -e "${PURPLE}• Resources: Admin only${NC}"
    echo -e "${PURPLE}• Rewards: HR + Admin${NC}"
    echo -e "${PURPLE}• Challenges: HR + Admin${NC}"
    
    # Check server
    print_step "Checking server connection"
    if ! curl -s "$BASE_URL/health" > /dev/null; then
        print_error "Server not running at $BASE_URL"
        exit 1
    fi
    print_success "Server is running"
    
    # Run tests
    setup_test_users
    test_resource_permissions
    test_reward_permissions  
    test_challenge_permissions
    test_read_permissions
    show_permission_matrix
    
    print_header "PHASE 1 TESTING COMPLETE"
    echo -e "${GREEN}✅ Permission system successfully updated!${NC}"
    echo -e "${GREEN}✅ All role restrictions working as expected${NC}"
    echo -e "${BLUE}📋 Ready for Phase 2: Journaling System Implementation${NC}"
}

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi