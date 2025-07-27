const { ONBOARDING_QUESTIONS } = require('../controllers/onboarding.controller');

/**
 * Middleware to transform onboarding data from frontend format to backend format
 * Handles both formats:
 * 1. Frontend: { ageRange: "25-34", department: "Engineering", ... }
 * 2. Backend: { answers: { ageRange: "25-34", department: "Engineering", ... } }
 */
const transformOnboardingData = (req, res, next) => {
  try {
    // If answers object already exists, no transformation needed
    if (req.body.answers && typeof req.body.answers === 'object') {
      console.log('✅ Onboarding data already in correct format (wrapped)');
      return next();
    }

    // Collect all valid question IDs from the questionnaire structure
    const validQuestionIds = [];
    for (const [sectionKey, section] of Object.entries(ONBOARDING_QUESTIONS)) {
      for (const question of section.questions) {
        validQuestionIds.push(question.id);
      }
    }

    // Extract questionnaire fields from request body
    const answers = {};
    let extractedCount = 0;

    for (const questionId of validQuestionIds) {
      if (req.body[questionId] !== undefined) {
        answers[questionId] = req.body[questionId];
        extractedCount++;
        // Remove from original body to avoid duplication
        delete req.body[questionId];
      }
    }

    // If we found questionnaire fields, wrap them in answers object
    if (extractedCount > 0) {
      req.body.answers = answers;
      console.log(`✅ Transformed ${extractedCount} onboarding fields from frontend format to backend format`);
      console.log('Extracted fields:', Object.keys(answers));
    } else {
      console.log('⚠️ No valid onboarding fields found in request body');
    }

    next();
  } catch (error) {
    console.error('❌ Error in onboarding data transformation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process onboarding data',
      error: error.message
    });
  }
};

module.exports = transformOnboardingData;