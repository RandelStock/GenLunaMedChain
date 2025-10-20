// backend/routes/test-email.js
// Add this route to test email service directly

import express from 'express';
import { sendEmail } from '../utils/emailService.js';

const router = express.Router();

/**
 * POST /test-email/send
 * Test email sending functionality
 */
router.post('/send', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    console.log('🧪 Testing email service...');
    console.log('📧 Sending test email to:', to);
    console.log('📤 Using EMAIL_USER:', process.env.EMAIL_USER);
    console.log('🔑 EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
    console.log('🔑 EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length || 0);

    const testSubject = '✅ Test Email from GenLunaMedChain';
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .success { background: #10b981; color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 GenLunaMedChain</h1>
            <h2>Email Service Test</h2>
          </div>
          
          <div class="content">
            <div class="success">
              ✅ Email Service is Working!
            </div>
            
            <p style="margin-top: 30px;">Dear User,</p>
            
            <p>If you're reading this email, it means the email service is configured correctly and working!</p>
            
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>From: ${process.env.EMAIL_USER}</li>
              <li>To: ${to}</li>
            </ul>
            
            <p>You can now use the consultation booking system with confidence that email notifications will be delivered.</p>
            
            <p>Thank you for using GenLunaMedChain!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail(to, testSubject, testHtml);

    if (result.success) {
      console.log('✅ Test email sent successfully!');
      res.json({
        success: true,
        message: 'Test email sent successfully! Check your inbox (and spam folder).',
        details: {
          to: to,
          from: process.env.EMAIL_USER,
          messageId: result.messageId,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ Test email failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to send test email. Check backend logs for details.'
      });
    }

  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Email service error. Check environment variables and Gmail App Password.'
    });
  }
});

/**
 * GET /test-email/config
 * Check email configuration
 */
router.get('/config', (req, res) => {
  const config = {
    emailUser: process.env.EMAIL_USER || 'NOT SET',
    emailPasswordSet: !!process.env.EMAIL_PASSWORD,
    emailPasswordLength: process.env.EMAIL_PASSWORD?.length || 0,
    nodeEnv: process.env.NODE_ENV || 'development'
  };

  console.log('📋 Email Configuration Check:');
  console.log('  EMAIL_USER:', config.emailUser);
  console.log('  EMAIL_PASSWORD:', config.emailPasswordSet ? '✅ SET' : '❌ NOT SET');
  console.log('  PASSWORD LENGTH:', config.emailPasswordLength);

  res.json({
    success: true,
    config: {
      ...config,
      // Hide the actual password
      emailPassword: config.emailPasswordSet ? '***SET***' : 'NOT SET'
    },
    message: config.emailPasswordSet 
      ? 'Email configuration looks good!' 
      : 'Email configuration incomplete. Set EMAIL_USER and EMAIL_PASSWORD environment variables.'
  });
});

export default router;