const express = require('express');
const router = express.Router();
const surveyScheduler = require('../services/survey.scheduler');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require admin/hr authentication
router.use(authenticate);
router.use(authorize(['admin', 'hr']));

/**
 * @route   POST /api/surveys/management/trigger-weekly-pulse
 * @desc    Manually trigger weekly pulse survey creation (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.post('/trigger-weekly-pulse', async (req, res) => {
  try {
    const survey = await surveyScheduler.triggerWeeklyPulseSurvey();
    
    res.json({
      success: true,
      message: 'Weekly pulse survey creation triggered successfully',
      data: { survey }
    });
  } catch (error) {
    console.error('Error triggering weekly pulse survey:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger weekly pulse survey creation'
    });
  }
});

/**
 * @route   POST /api/surveys/management/trigger-reminders
 * @desc    Manually trigger survey reminder notifications (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.post('/trigger-reminders', async (req, res) => {
  try {
    await surveyScheduler.triggerSurveyReminders();
    
    res.json({
      success: true,
      message: 'Survey reminders triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering survey reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger survey reminders'
    });
  }
});

/**
 * @route   POST /api/surveys/management/trigger-closures
 * @desc    Manually trigger survey closure process (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.post('/trigger-closures', async (req, res) => {
  try {
    await surveyScheduler.triggerSurveyClosures();
    
    res.json({
      success: true,
      message: 'Survey closures triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering survey closures:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger survey closures'
    });
  }
});

/**
 * @route   POST /api/surveys/management/schedule-custom
 * @desc    Schedule a custom recurring survey (Admin/HR only)
 * @access  Private (Admin/HR)
 * @body    {surveyData, scheduleOptions}
 */
router.post('/schedule-custom', async (req, res) => {
  try {
    const { surveyData, scheduleOptions } = req.body;
    
    if (!surveyData || !scheduleOptions) {
      return res.status(400).json({
        success: false,
        message: 'Both surveyData and scheduleOptions are required'
      });
    }
    
    // Add creator info
    surveyData.createdBy = req.user.id;
    
    const survey = await surveyScheduler.scheduleCustomSurvey(surveyData, scheduleOptions);
    
    res.json({
      success: true,
      message: 'Custom survey scheduled successfully',
      data: { survey }
    });
  } catch (error) {
    console.error('Error scheduling custom survey:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule custom survey'
    });
  }
});

/**
 * @route   GET /api/surveys/management/scheduler-status
 * @desc    Get survey scheduler status and upcoming jobs (Admin/HR only)
 * @access  Private (Admin/HR)
 */
router.get('/scheduler-status', (req, res) => {
  try {
    const status = {
      active: true,
      scheduledJobs: surveyScheduler.scheduledJobs.size,
      nextWeeklyPulse: 'Every Monday at 9:00 AM',
      dailyReminders: 'Every day at 10:00 AM',
      closureCheck: 'Every day at 11:59 PM'
    };
    
    res.json({
      success: true,
      message: 'Survey scheduler status retrieved',
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status'
    });
  }
});

module.exports = router;