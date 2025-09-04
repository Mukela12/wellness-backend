# Client Testing Guide: Slack Integration for Wellness Platform

This guide is designed for clients to test the Slack integration features of the wellness platform from an end-user perspective, using the frontend application.

## Overview

The wellness platform integrates with Slack to:
- Send wellness surveys directly to employees via Slack
- Allow quick mood check-ins through Slack commands
- Provide interactive survey responses without leaving Slack
- Award Happy Coins for participation
- Send reminders and notifications

## Required Test Accounts

For comprehensive testing, you'll need:

### 1. **Admin Account** (1 required)
- Can create and manage surveys
- Can view all employee responses
- Can configure integration settings
- Can send surveys to specific departments/users

### 2. **Employee Accounts** (2-3 recommended)
- Regular users who receive and respond to surveys
- Can connect their Slack accounts
- Can use slash commands for check-ins
- At least one should be in a different department for testing targeted surveys

### 3. **Slack Workspace**
- You'll need access to a Slack workspace (can use a free test workspace)
- Admin access to install the Wellness Bot app

## Testing Scenarios

### Scenario 1: Initial Setup (Admin)

1. **Login as Admin**
   - Access the wellness platform frontend
   - Navigate to Settings/Integrations

2. **Connect Slack to Platform**
   - Look for "Slack Integration" section
   - Click "Install Slack App" or "Connect to Slack"
   - You'll be redirected to Slack's authorization page
   - Select your workspace and click "Allow"
   - You should be redirected back with a success message

3. **Verify Connection**
   - Check that the integration shows as "Connected"
   - Note the workspace name displayed
   - The Wellness Bot should appear in your Slack workspace

### Scenario 2: Employee Slack Connection

1. **Login as Employee #1**
   - Go to Profile/Settings
   - Find "Integrations" or "Connected Accounts" section

2. **Connect Personal Slack Account**
   - Click "Connect Slack"
   - Authorize the app for your personal Slack account
   - Verify connection shows your Slack username
   - Should see "Connected to [Workspace Name]"

3. **Repeat for Employee #2 and #3**

### Scenario 3: Testing Survey Distribution

1. **As Admin, Create a Test Survey**
   ```
   Title: Weekly Wellness Check
   Questions:
   1. How would you rate your mood today? (Scale 1-5)
   2. How is your energy level? (Scale 1-5)
   3. Any concerns to share? (Text, optional)
   
   Settings:
   - Distribution: Slack + Email
   - Target: All Employees
   - Rewards: 50 Happy Coins
   ```

2. **Send Survey**
   - Select "Send via Slack" option
   - Choose recipients (all employees or specific ones)
   - Click "Send Now"

3. **Verify in Slack (as Employees)**
   - Each connected employee should receive a DM from Wellness Bot
   - Survey should appear with interactive buttons/dropdowns
   - Questions should be clearly formatted

### Scenario 4: Testing Slash Commands

1. **As Employee in Slack**
   
   **Test Quick Check-in:**
   ```
   /quick-checkin
   ```
   - Should see 5 mood buttons
   - Click one (e.g., "Good")
   - Should receive confirmation with Happy Coins earned
   - Try again same day - should say "already checked in"

   **Test Survey Command:**
   ```
   /wellness-survey
   ```
   - Should list available surveys
   - Click "Take Survey" on any survey
   - Complete and submit

### Scenario 5: Testing Survey Responses

1. **Complete Survey in Slack (as Employee)**
   - Answer all required questions
   - Use dropdown for scale questions
   - Type text for open-ended questions
   - Click "Submit Survey"

2. **Verify Response (as Admin)**
   - Check survey responses in admin dashboard
   - Verify employee's response is recorded
   - Check timestamps match

3. **Verify Rewards (as Employee)**
   - Check Happy Coins balance increased
   - Verify streak updates if applicable

### Scenario 6: Testing Notifications

1. **Configure Notification Preferences (as Employee)**
   - Set preferred channel to "Slack"
   - Enable survey reminders
   - Set reminder time

2. **Test Reminder Flow (as Admin)**
   - Create a survey with a deadline
   - Wait for reminder time
   - Employees should receive Slack reminder

### Scenario 7: Testing Error Cases

1. **Disconnected Account**
   - As Employee, disconnect Slack
   - Try `/wellness-survey` in Slack
   - Should get "Please connect your account" message

2. **No Active Surveys**
   - As Admin, deactivate all surveys
   - As Employee, try `/wellness-survey`
   - Should see "No surveys available"

3. **Duplicate Daily Check-in**
   - Complete `/quick-checkin`
   - Try again immediately
   - Should prevent duplicate

## Expected User Experience

### For Employees:

1. **One-time Setup**
   - Connect Slack account in wellness platform
   - Takes less than 1 minute

2. **Daily Usage**
   - Receive survey notifications in Slack DM
   - Use `/quick-checkin` for mood tracking
   - Complete surveys without leaving Slack
   - See Happy Coins earned immediately

3. **Benefits**
   - No context switching
   - Quick responses via buttons
   - Instant feedback
   - Streak tracking

### For Admins:

1. **Survey Management**
   - Create surveys in web platform
   - Choose Slack as distribution channel
   - Target specific groups
   - Real-time response tracking

2. **Analytics**
   - See response rates by channel
   - Track Slack vs email engagement
   - Monitor employee wellness trends

## Testing Checklist

### Admin Tasks:
- [ ] Connect Slack workspace to platform
- [ ] Create test survey
- [ ] Send survey via Slack
- [ ] View responses in dashboard
- [ ] Check analytics for Slack responses

### Employee Tasks:
- [ ] Connect personal Slack account
- [ ] Receive survey in Slack DM
- [ ] Complete survey using interactive buttons
- [ ] Use `/quick-checkin` command
- [ ] Use `/wellness-survey` command
- [ ] Verify Happy Coins received
- [ ] Check streak is maintained

### Integration Features:
- [ ] OAuth flow works smoothly
- [ ] Surveys display correctly in Slack
- [ ] Interactive components are responsive
- [ ] Responses save to database
- [ ] Rewards are granted properly
- [ ] Notifications arrive on time
- [ ] Error messages are helpful

## Common Issues and Solutions

### "App not found in workspace"
- Admin needs to install the Wellness Bot app first
- Check workspace permissions

### "Please connect your account"
- Employee needs to link Slack account in web platform
- Go to Settings > Integrations

### "No surveys available"
- Admin needs to create and activate surveys
- Check survey targeting settings

### Buttons not responding
- Refresh Slack
- Check internet connection
- Try web platform if persistent

## Success Metrics

Your Slack integration is working properly when:

1. **Connection Success Rate**: All test users can connect accounts
2. **Message Delivery**: 100% of surveys reach Slack-connected users
3. **Response Rate**: Users can complete surveys entirely in Slack
4. **Data Integrity**: All responses appear in admin dashboard
5. **Reward Accuracy**: Happy Coins are awarded correctly
6. **Command Functionality**: Both slash commands work reliably

## Support Resources

- Check integration status in Settings
- View connection logs in admin panel
- Test with different survey types
- Verify Slack workspace settings
- Contact support if issues persist

## Next Steps

After successful testing:
1. Train employees on Slack features
2. Set up regular survey schedules
3. Monitor engagement metrics
4. Gather feedback on user experience
5. Optimize survey timing and frequency