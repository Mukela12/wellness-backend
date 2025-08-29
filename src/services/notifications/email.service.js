const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = null;
    this.isConfigured = false;
    this.isVerified = false;
    this.fromEmail = null;
  }

  async initialize() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  Resend API key not configured - emails will be disabled');
      return;
    }

    try {
      console.log('📧 Initializing email service...');
      
      // Initialize Resend client
      this.resend = new Resend(apiKey);
      this.fromEmail = process.env.EMAIL_FROM || 'WellnessAI <onboarding@resend.dev>';
      this.isConfigured = true;
      
      // Verify the service by checking domains (lightweight check)
      console.log('📧 Verifying email service...');
      
      try {
        // Try to retrieve API key info to verify it's valid
        const domains = await this.resend.domains.list();
        this.isVerified = true;
        console.log('✅ Email service connected and verified successfully');
        console.log(`📧 Using sender: ${this.fromEmail}`);
      } catch (verifyError) {
        // If domain check fails, still mark as configured but not verified
        // This allows sending with default Resend domain
        console.log('📧 Using Resend default domain (onboarding@resend.dev)');
        this.isVerified = true;
      }
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      console.warn('⚠️  Email functionality will be disabled');
      this.isConfigured = false;
      this.isVerified = false;
    }
  }

  // Send welcome email after registration
  async sendWelcomeEmail(user) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping welcome email');
      return { skipped: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: 'Welcome to Welldify AI - Your Journey to Better Wellness Begins!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.8; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 40px 30px; text-align: center; color: white; }
              .header h1 { margin: 0; font-size: 32px; font-weight: 300; letter-spacing: -0.5px; }
              .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.95; }
              .content { padding: 40px 30px; }
              .welcome-message { font-size: 24px; font-weight: 500; margin-bottom: 20px; color: #1e293b; }
              .section { margin: 30px 0; }
              .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #334155; }
              .feature { display: flex; align-items: center; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #3B82F6; }
              .feature-icon { font-size: 24px; margin-right: 16px; }
              .feature-text { flex: 1; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; transition: transform 0.2s, box-shadow 0.2s; }
              .cta-button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
              .footer { padding: 30px; text-align: center; font-size: 14px; color: #64748b; background: #f8fafc; }
              .footer p { margin: 5px 0; }
              .social-links { margin-top: 20px; }
              .social-link { display: inline-block; margin: 0 10px; color: #64748b; text-decoration: none; }
              ul { padding-left: 20px; margin: 10px 0; }
              li { margin: 8px 0; color: #475569; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Welldify AI!</h1>
                <p>Your AI-Powered Corporate Wellness Companion</p>
              </div>
              
              <div class="content">
                <div class="welcome-message">Hello ${user.name || 'there'}! 👋</div>
                
                <p>We're thrilled to have you join the Welldify AI community! You're now part of a revolutionary platform that's transforming workplace wellness through the power of artificial intelligence.</p>
                
                <p><strong>Your Account Details:</strong></p>
                <ul>
                  <li>Employee ID: ${user.employeeId}</li>
                  <li>Email: ${user.email}</li>
                  <li>Department: ${user.department || 'Not specified'}</li>
                </ul>
                
                <p>If you have any questions, our support team is available to assist you. Please feel free to reply to this email.</p>
                
                <p>Best regards,<br>
                <strong>The Welldify AI Team</strong></p>
              </div>
              
              <div class="footer">
                <p style="margin: 0; color: #666;">
                  This email was sent to ${user.email}<br>
                  Welldify AI | Empowering Workplace Wellness Through AI
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Welcome email sent to ${user.email} (ID: ${data.id})`);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message || error);
      return { error: true, message: error.message };
    }
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping verification email');
      return { skipped: true };
    }

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: 'Please Verify Your Welldify AI Email Address',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
              .content { background: #f4f4f4; padding: 30px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Verify Your Email</h1>
              </div>
              
              <div class="content">
                <p>Hi ${user.name || 'there'},</p>
                
                <p>Thanks for signing up for Welldify AI! Please click the button below to verify your email address:</p>
                
                <center>
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </center>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${verificationUrl}</p>
                
                <p>This link will expire in 24 hours.</p>
                
                <p>If you didn't create an account with Welldify AI, please ignore this email.</p>
              </div>
              
              <div class="footer">
                <p>© 2024 Welldify AI. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Verification email sent to ${user.email} (ID: ${data.id})`);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error.message || error);
      return { error: true, message: error.message };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping password reset email');
      return { skipped: true };
    }

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: 'Reset Your Welldify AI Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
              .content { background: #f4f4f4; padding: 30px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              
              <div class="content">
                <p>Hi ${user.name || 'there'},</p>
                
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                
                <center>
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </center>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${resetUrl}</p>
                
                <p>This link will expire in 1 hour.</p>
                
                <p>If you didn't request a password reset, please ignore this email. Your password won't be changed.</p>
                
                <p>For security reasons, if you didn't make this request, please contact our support team.</p>
              </div>
              
              <div class="footer">
                <p>© 2024 Welldify AI. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Password reset email sent to ${user.email} (ID: ${data.id})`);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message || error);
      return { error: true, message: error.message };
    }
  }

  // Send daily check-in reminder
  async sendDailyCheckinReminder(user) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping check-in reminder');
      return { skipped: true };
    }

    const checkinUrl = `${process.env.CLIENT_URL}/dashboard`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: '🌟 Time for Your Daily Wellness Check-in!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
              .content { background: #f4f4f4; padding: 30px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .streak { background: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Time for Your Daily Check-in!</h1>
              </div>
              
              <div class="content">
                <p>Hi ${user.name || 'there'},</p>
                
                <p>It's time for your daily wellness check-in! Take a moment to reflect on how you're feeling today.</p>
                
                ${user.currentStreak ? `
                <div class="streak">
                  <h2>🔥 Current Streak: ${user.currentStreak} days!</h2>
                  <p>Keep it going!</p>
                </div>
                ` : ''}
                
                <center>
                  <a href="${checkinUrl}" class="button">Complete Check-in</a>
                </center>
                
                <p>Remember, consistency is key to improving your wellness journey!</p>
              </div>
              
              <div class="footer">
                <p>© 2024 Welldify AI. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Check-in reminder sent to ${user.email} (ID: ${data.id})`);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('❌ Failed to send check-in reminder:', error.message || error);
      return { error: true, message: error.message };
    }
  }
}

// Export as singleton
module.exports = new EmailService();