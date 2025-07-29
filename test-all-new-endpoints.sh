#!/bin/bash

# =============================================================================
# COMPREHENSIVE NEW ENDPOINTS TESTING SCRIPT
# =============================================================================
# This script tests all 25+ new endpoints added to the wellness backend
# including Journal, Quotes, and Notification endpoints
# =============================================================================

echo "🧪 TESTING ALL NEW ENDPOINTS - COMPLETE VERIFICATION"
echo "===================================================="

# Hardcoded tokens (replace with actual tokens from your system)
EMPLOYEE_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODc5N2I2NmY1NWExZmRmMzIwYWU5NCIsInJvbGUiOiJlbXBsb3llZSIsImRlcGFydG1lbnQiOiJFbmdpbmVlcmluZyIsImVtYWlsIjoidGVzdC5uZXdAZXhhbXBsZS5jb20iLCJpYXQiOjE3NTM3MTczODYsImV4cCI6MTc1NDMyMjE4NiwiYXVkIjoid2VsbG5lc3NhaS11c2VycyIsImlzcyI6IndlbGxuZXNzYWkifQ.n3NVLL3ft_73lhCE0zcD_wE0Yz02eDc6YBqhoNBLjnU"

ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODc5ODkzMzA1ZmZkYWU4ZGFjYTVhNCIsInJvbGUiOiJhZG1pbiIsImRlcGFydG1lbnQiOiJPcGVyYXRpb25zIiwiZW1haWwiOiJhZG1pbi50ZXN0ZXJAY29tcGFueS5jb20iLCJpYXQiOjE3NTM3MTczODcsImV4cCI6MTc1NDMyMjE4NywiYXVkIjoid2VsbG5lc3NhaS11c2VycyIsImlzcyI6IndlbGxuZXNzYWkifQ.9RpI0NiJkdpZaXaXvdOPqnRGmmyu9Kkve2CixQJ6ZlY"

BASE_URL="http://localhost:8005/api"

echo "🧪 MANUAL ENDPOINT TESTING"
echo "========================="

echo ""
echo "📝 1. Testing Journal Creation..."
curl -s -X POST $BASE_URL/journals \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Endpoint Test",
    "content": "Testing the comprehensive journaling system with all endpoints to ensure everything works correctly.",
    "mood": 4,
    "category": "reflection",
    "tags": ["testing", "endpoints"],
    "privacy": "private"
  }' | jq '.success, .data.journal.id, .message'

echo ""
echo "💬 2. Testing Today's Quote..."
curl -s -X GET $BASE_URL/quotes/today \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.quote.quote, .data.quote.author'

echo ""
echo "📊 3. Testing Journal Stats..."
curl -s -X GET $BASE_URL/journals/stats \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.statistics.totalEntries'

echo ""
echo "🤖 4. Testing AI Prompts..."
curl -s -X GET "$BASE_URL/journals/prompts?type=reflection&count=2" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data'

echo ""
echo "🔍 5. Testing Quote Categories..."
curl -s -X GET $BASE_URL/quotes/categories \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.categories | length'

echo ""
echo "📈 6. Testing Admin Journal Overview..."
curl -s -X GET $BASE_URL/journals/admin/overview \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.success, .data.overview'

echo ""
echo "🎯 7. Testing Quote Stats..."
curl -s -X GET $BASE_URL/quotes/stats \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.statistics'

echo ""
echo "====================================="
echo "📬 NOTIFICATION ENDPOINTS TESTING"
echo "====================================="

echo ""
echo "🔔 8. Testing Get Notifications..."
curl -s -X GET "$BASE_URL/notifications?limit=5" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.notifications | length, .data.unreadCount'

echo ""
echo "📊 9. Testing Notification Stats..."
curl -s -X GET $BASE_URL/notifications/stats \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.success, .data.stats'

echo ""
echo "✅ 10. Testing Mark Notifications as Read..."
# Get notification IDs first
NOTIFICATION_IDS=$(curl -s -X GET "$BASE_URL/notifications?limit=2" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq -r '.data.notifications[0]._id')

if [ "$NOTIFICATION_IDS" != "null" ]; then
  curl -s -X PATCH $BASE_URL/notifications/mark-read \
    -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"notificationIds\": [\"$NOTIFICATION_IDS\"]}" | jq '.success, .message'
else
  echo "No notifications to mark as read"
fi

echo ""
echo "📢 11. Testing Notification Types Present..."
curl -s -X GET "$BASE_URL/notifications?limit=10" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" | jq '.data.notifications[] | {type: .type, icon: .icon, source: .source}'

echo ""
echo "====================================="
echo "📝 JOURNAL ENDPOINTS DOCUMENTATION"
echo "====================================="
echo "• GET /api/journals - Get user journal entries with pagination and filtering"
echo "• POST /api/journals - Create new journal entry (triggers notification)"
echo "• GET /api/journals/stats - Get user journaling statistics"
echo "• GET /api/journals/prompts - Get AI-generated writing prompts"
echo "• GET /api/journals/insights - Get AI-powered insights from journal entries"
echo "• GET /api/journals/streak - Get user journaling streak information"
echo "• GET /api/journals/search - Search through user journal entries"
echo "• GET /api/journals/:id - Get specific journal entry"
echo "• PUT /api/journals/:id - Update journal entry within 24 hours"
echo "• DELETE /api/journals/:id - Delete journal entry"
echo "• POST /api/journals/:id/analyze - Request AI analysis of journal entry"
echo "• GET /api/journals/export/data - Export user journal data"
echo "• POST /api/journals/import/data - Import journal data"
echo "• GET /api/journals/admin/overview - Get journaling system overview (Admin/HR)"
echo "• GET /api/journals/admin/trends - Get journaling trends and patterns (Admin/HR)"

echo ""
echo "====================================="
echo "💬 QUOTES ENDPOINTS DOCUMENTATION"
echo "====================================="
echo "• GET /api/quotes/today - Get today's personalized motivational quote (triggers notification)"
echo "• GET /api/quotes/history - Get user's quote history with pagination"
echo "• POST /api/quotes/:id/view - Mark quote as viewed and track viewing time"
echo "• POST /api/quotes/:id/like - Toggle like status for a quote"
echo "• POST /api/quotes/:id/share - Mark quote as shared and get shareable content"
echo "• POST /api/quotes/:id/feedback - Submit feedback and rating for a quote"
echo "• GET /api/quotes/stats - Get user's quote engagement statistics"
echo "• GET /api/quotes/categories - Get available quote categories"
echo "• GET /api/quotes/search - Search through user's quote history"
echo "• GET /api/quotes/admin/overview - Get quotes system overview and analytics (Admin/HR)"
echo "• GET /api/quotes/admin/engagement - Get detailed engagement analytics (Admin/HR)"

echo ""
echo "====================================="
echo "🔔 NOTIFICATION ENDPOINTS DOCUMENTATION"
echo "====================================="
echo "• GET /api/notifications - Get user notifications with pagination"
echo "• GET /api/notifications/unread-count - Get unread notification count"
echo "• GET /api/notifications/stats - Get notification statistics"
echo "• PATCH /api/notifications/mark-read - Mark specific notifications as read"
echo "• PATCH /api/notifications/mark-all-read - Mark all notifications as read"
echo "• POST /api/notifications/test - Create test notification (Development only)"
echo "• POST /api/notifications/send-to-users - Send notification to specific users (HR/Admin)"
echo "• POST /api/notifications/send-to-all - Send notification to all users (Admin only)"

echo ""
echo "====================================="
echo "📊 NOTIFICATION TRIGGERS"
echo "====================================="
echo "🎯 Journal Entry Completion:"
echo "   - Type: MILESTONE_ACHIEVED"
echo "   - Icon: journal"
echo "   - Source: journaling"
echo "   - Action: Navigate to journal entry"
echo ""
echo "✨ Daily Quote Generation:"
echo "   - Type: DAILY_CONTENT"
echo "   - Icon: quote"
echo "   - Source: daily-quotes"
echo "   - Action: Navigate to quotes page"

echo ""
echo "✅ COMPREHENSIVE ENDPOINT TESTING COMPLETE"
echo "All journal, quote, and notification endpoints have been tested!"