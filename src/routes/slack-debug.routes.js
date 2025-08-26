const express = require('express');
const router = express.Router();

// Debug endpoint for Slack commands - logs everything
router.post('/debug-commands', express.raw({ type: '*/*' }), (req, res) => {
  console.log('=== SLACK DEBUG ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Raw Body:', req.body.toString());
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('==================');
  
  // Always return success to Slack
  res.status(200).json({
    response_type: 'ephemeral',
    text: 'Debug endpoint received your command'
  });
});

module.exports = router;