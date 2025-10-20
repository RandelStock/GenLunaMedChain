// backend/routes/test-email.js
import express from 'express';
import { sendEmail } from '../utils/emailService.js';

const router = express.Router();

/**
 * GET /test-email/config
 * Check email configuration
 */
router.get('/config', (req, res) => {
  try {
    const config = {
      emailUser: process.env.EMAIL_USER || 'NOT SET',
      emailPasswordSet: !!process.env.EMAIL_PASSWORD,
      emailPasswordLength: process.env.EMAIL_PASSWORD?.length || 0,
      sendgridApiKeySet: !!process.env.SENDGRID_API_KEY,
      sendgridApiKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV || 'development',
      provider: process.env.SENDGRID_API_KEY ? 'SendGrid API' : 'Gmail SMTP'
    };

    console.log('📋 Email Configuration Check:');
    console.log('  EMAIL_USER:', config.emailUser);
    console.log('  EMAIL_PASSWORD:', config.emailPasswordSet ? '✅ SET' : '❌ NOT SET');
    console.log('  PASSWORD LENGTH:', config.emailPasswordLength);
    console.log('  SENDGRID_API_KEY:', config.sendgridApiKeySet ? '✅ SET' : '❌ NOT SET');
    console.log('  SENDGRID KEY LENGTH:', config.sendgridApiKeyLength);
    console.log('  PROVIDER:', config.provider);

    const isConfigured = config.emailUser !== 'NOT SET' && 
                        (config.sendgridApiKeySet || config.emailPasswordSet);

    res.json({
      success: isConfigured,
      config: config,
      message: isConfigured 
        ? 'Email configuration looks good!' 
        : 'Email configuration incomplete. Set EMAIL_USER and either SENDGRID_API_KEY or EMAIL_PASSWORD.'
    });
  } catch (error) {
    console.error('❌ Config check error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error checking email configuration'
    });
  }
});

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format'
      });
    }

    console.log('🧪 Testing email service...');
    console.log('📧 Sending test email to:', to);
    console.log('📤 Using EMAIL_USER:', process.env.EMAIL_USER);
    console.log('🔑 SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
    console.log('🔑 EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
    console.log('🔑 EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length || 0);

    const provider = process.env.SENDGRID_API_KEY ? 'SendGrid API' : 'Gmail SMTP';
    
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
          .success { background: #10b981; color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
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
            
            <p>Dear User,</p>
            
            <p>If you're reading this email, it means the email service is configured correctly and working perfectly! 🎉</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #667eea;">📧 Test Details</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Sent at:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>From:</strong> ${process.env.EMAIL_USER}</li>
                <li><strong>To:</strong> ${to}</li>
                <li><strong>Provider:</strong> ${provider}</li>
              </ul>
            </div>
            
            <p>You can now use the consultation booking system with confidence that email notifications will be delivered to patients and healthcare providers.</p>
            
            <p style="margin-top: 30px;">Thank you for using GenLunaMedChain!</p>
          </div>
          
          <div class="footer">
            <p><strong>GenLunaMedChain</strong></p>
            <p>Your Blockchain-Powered Healthcare Platform</p>
            <p style="margin-top: 10px;">This is an automated test email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail(to, testSubject, testHtml);

    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📊 Provider used:', result.provider);
      console.log('📨 Message ID:', result.messageId);
      
      res.json({
        success: true,
        message: 'Test email sent successfully! Check your inbox (and spam folder).',
        details: {
          to: to,
          from: process.env.EMAIL_USER,
          messageId: result.messageId,
          provider: result.provider,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ Test email failed:', result.error);
      console.error('📋 Error code:', result.code);
      
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code,
        details: result.details,
        message: 'Failed to send test email. Check backend logs for details.'
      });
    }

  } catch (error) {
    console.error('❌ Test email error:', error);
    console.error('📋 Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Email service error. Check environment variables and email configuration.'
    });
  }
});

export default router;