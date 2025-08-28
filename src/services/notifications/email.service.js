const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    
    if (this.isConfigured) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true' || false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        },
        // Add connection timeout settings
        connectionTimeout: 5000, // 5 seconds
        greetingTimeout: 5000,  // 5 seconds
        socketTimeout: 10000    // 10 seconds
      });

      // Verify transporter configuration
      this.verifyConnection();
    } else {
      console.warn('⚠️  Email service not configured - emails will be disabled');
      this.transporter = null;
    }
  }

  async verifyConnection() {
    try {
      // Don't verify connection if email is not configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email service not configured - skipping connection verification');
        return;
      }
      
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      // Don't throw - allow the service to start even if email is unavailable
    }
  }

  // Send welcome email after registration
  async sendWelcomeEmail(user) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping welcome email');
      return { skipped: true };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Welldify AI <noreply@welldify.ai>',
      to: user.email,
      subject: 'Welcome to Welldify AI - Your Workplace Wellness Journey Begins',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Welldify AI</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #add0b3, #87ceeb); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e8ed; }
            .footer { background: #f5f5f7; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; padding: 12px 24px; background: #add0b3; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            .feature { margin: 20px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #add0b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: white; margin: 0;">Welcome to Welldify AI</h1>
              <p style="color: white; margin: 10px 0 0 0;">Your AI-Powered Workplace Wellness Platform</p>
            </div>
            
            <div class="content">
              <h2>Dear ${user.name},</h2>
              
              <p>Welcome to Welldify AI. We are pleased to have you join our workplace wellness platform designed to support your mental health and overall wellbeing.</p>
              
              <div class="feature">
                <h3>Getting Started</h3>
                <p>Complete your onboarding questionnaire to get personalized wellness insights and start earning Happy Coins!</p>
              </div>
              
              <div class="feature">
                <h3>Daily Wellness Check-ins</h3>
                <p>Take 30 seconds each day to rate your mood and share how you're feeling. Your responses help us support you better.</p>
              </div>
              
              <div class="feature">
                <h3>Rewards System</h3>
                <p>Earn coins for daily check-ins, completing surveys, and engaging with wellness activities. Redeem them for awesome rewards!</p>
              </div>
              
              <div class="feature">
                <h3>Personalized AI Insights</h3>
                <p>Get personalized recommendations, mood analysis, and wellness tips tailored to your unique profile.</p>
              </div>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 6px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #856404;">⚠️ Email Verification Required</h3>
                <p style="margin: 0; color: #856404;">
                  Please check your inbox for a separate email to verify your email address. 
                  You must verify your email before you can log in and start your wellness journey.
                </p>
              </div>
              
              <p><strong>Your Account Details:</strong></p>
              <ul>
                <li>Employee ID: ${user.employeeId}</li>
                <li>Email: ${user.email}</li>
                <li>Department: ${user.department}</li>
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
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${user.email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw error;
    }
  }

  // Send email verification
  async sendEmailVerification(user, verificationToken) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping verification email');
      return { skipped: true };
    }

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Welldify AI <noreply@welldify.ai>',
      to: user.email,
      subject: 'Please Verify Your Welldify AI Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #add0b3; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e8ed; }
            .footer { background: #f5f5f7; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; padding: 15px 30px; background: #add0b3; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .security-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: white; margin: 0;">Email Verification Required</h1>
            </div>
            
            <div class="content">
              <h2>Dear ${user.name},</h2>
              
              <p>Thank you for registering with Welldify AI. To complete your account setup and access all platform features, please verify your email address.</p>
              
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="btn">Verify Email Address</a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
              
              <div class="security-note">
                <strong>Security Notice:</strong><br>
                This verification link will expire in 24 hours for your security. If you did not create a Welldify AI account, please disregard this email.
              </div>
              
              <p>Once verified, you'll be able to:</p>
              <ul>
                <li>Complete your personalized onboarding</li>
                <li>Start daily wellness check-ins</li>
                <li>Earn Happy Coins for rewards</li>
                <li>Access AI-powered wellness insights</li>
              </ul>
              
              <p>Need assistance? Please reply to this email and our support team will be happy to help.</p>
              
              <p>Sincerely,<br>
              <strong>The Welldify AI Team</strong></p>
            </div>
            
            <div class="footer">
              <p style="margin: 0; color: #666;">
                This email was sent to ${user.email}<br>
                Welldify AI | Secure. Private. Focused on Your Wellbeing.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${user.email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      throw error;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping password reset email');
      return { skipped: true };
    }
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Welldify AI <noreply@welldify.ai>',
      to: user.email,
      subject: 'Password Reset Request - Welldify AI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff6b6b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e1e8ed; }
            .footer { background: #f5f5f7; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; padding: 15px 30px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: white; margin: 0;">Password Reset Request</h1>
            </div>
            
            <div class="content">
              <h2>Dear ${user.name},</h2>
              
              <p>We received a request to reset your Welldify AI account password. If you initiated this request, please click the button below to create a new password.</p>
              
              <p style="text-align: center;">
                <a href="${resetUrl}" class="btn">Reset Password</a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              
              <div class="warning">
                <strong>Important Security Information:</strong><br>
                • This reset link expires in 10 minutes<br>
                • If you did not request this reset, please ignore this email<br>
                • Your password will not change unless you click the link above<br>
                • For security purposes, this link can only be used once
              </div>
              
              <p><strong>Did not request a password reset?</strong><br>
              Your account remains secure. Someone may have entered your email address by mistake. You can safely disregard this email.</p>
              
              <p>For additional security questions, please contact our support team by replying to this email.</p>
              
              <p>Regards,<br>
              <strong>The Welldify AI Security Team</strong></p>
            </div>
            
            <div class="footer">
              <p style="margin: 0; color: #666;">
                This email was sent to ${user.email}<br>
                Welldify AI | Your Privacy and Security Are Our Priority
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${user.email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  // Send daily check-in reminder
  async sendCheckInReminder(user) {
    if (!this.isConfigured) {
      console.log('Email service not configured - skipping check-in reminder');
      return { skipped: true };
    }
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Welldify AI <noreply@welldify.ai>',
      to: user.email,
      subject: 'Daily Wellness Check-in Reminder - Welldify AI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Check-in Reminder</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #add0b3, #87ceeb); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e1e8ed; }
            .footer { background: #f5f5f7; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; padding: 12px 24px; background: #add0b3; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            .streak { background: #e8f5e8; border: 1px solid #add0b3; padding: 15px; border-radius: 6px; text-align: center; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: white; margin: 0;">Time for Your Daily Check-in</h1>
            </div>
            
            <div class="content">
              <h2>Good morning, ${user.name},</h2>
              
              <p>Take a moment to reflect on your wellbeing. Your daily check-in helps us support you better and keeps you connected to your wellness journey.</p>
              
              ${user.wellness.currentStreak > 0 ? `
              <div class="streak">
                <h3 style="margin: 0; color: #2d5a2d;">Current Streak: ${user.wellness.currentStreak} days</h3>
                <p style="margin: 5px 0 0 0;">Excellent consistency. Keep up the great work!</p>
              </div>
              ` : ''}
              
              <p style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/checkin" class="btn">Start Check-in (30 seconds)</a>
              </p>
              
              <p><strong>Earn ${process.env.DAILY_CHECKIN_COINS || 50} Happy Coins</strong> for completing today's check-in.</p>
              
              <p style="font-size: 14px; color: #666;">
                <em>This daily reminder helps maintain consistency with your wellness goals. Notification preferences can be adjusted in your account settings.</em>
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0; color: #666; font-size: 12px;">
                Welldify AI | Supporting Your Daily Wellness Journey
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Check-in reminder sent to ${user.email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send check-in reminder:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();