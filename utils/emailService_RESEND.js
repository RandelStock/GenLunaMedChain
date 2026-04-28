import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ============================================
// RESEND.COM INITIALIZATION (PRIMARY - RECOMMENDED)
// ============================================
// Resend offers 100 emails/day FREE + 3,000/month on free tier
// Much better compliance and deliverability than Brevo with Gmail
let resendClient = null;

try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('📧 Resend.com API initialized successfully');
    console.log('   ✅ Free tier: 100 emails/day, 3,000/month');
  } else {
    console.warn('⚠️ RESEND_API_KEY not found in environment variables');
  }
} catch (error) {
  console.warn('⚠️ Resend API initialization failed:', error.message);
  console.warn('   Will use SMTP fallback for email delivery');
}

// ============================================
// GMAIL SMTP FALLBACK
// ============================================
const createGmailTransporter = () => {
  console.log('⚠️ Using Gmail SMTP (fallback method)');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Gmail credentials (EMAIL_USER, EMAIL_PASSWORD) not configured');
  }
  
  return nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
};

// ============================================
// EMAIL TEMPLATES (UNCHANGED)
// ============================================
const emailTemplates = {
  patientBookingConfirmation: (consultation, providerName) => ({
    subject: '✅ Consultation Booking Confirmed - GenLunaMedChain',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-label { font-weight: bold; color: #4b5563; }
          .info-value { color: #1f2937; }
          .meeting-link { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
          .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 GenLunaMedChain</h1>
            <h2>Consultation Confirmed!</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${consultation.patient_name}</strong>,</p>
            
            <p>Your telemedicine consultation has been successfully scheduled! Here are your appointment details:</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #667eea;">📅 Appointment Details</h3>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${new Date(consultation.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Time:</span>
                <span class="info-value">${consultation.scheduled_time}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Healthcare Provider:</span>
                <span class="info-value">${providerName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Consultation Type:</span>
                <span class="info-value">${consultation.consultation_type}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Chief Complaint:</span>
                <span class="info-value">${consultation.chief_complaint}</span>
              </div>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #10b981;">🎥 Video Meeting Details</h3>
              <p>Join your consultation using the link below at your scheduled time:</p>
              <div style="text-align: center;">
                <a href="${consultation.meeting_link}" class="meeting-link">Join Video Consultation</a>
              </div>
              <div class="info-row">
                <span class="info-label">Meeting ID:</span>
                <span class="info-value">${consultation.meeting_id}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Password:</span>
                <span class="info-value">${consultation.meeting_password}</span>
              </div>
            </div>

            <div class="alert">
              <strong>⏰ Important Reminders:</strong>
              <ul style="margin: 10px 0;">
                <li>Please join the meeting 5 minutes before your scheduled time</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Test your camera and microphone before the consultation</li>
                <li>Have your medical records and current medications list ready</li>
              </ul>
            </div>

            <p style="margin-top: 30px;">If you need to reschedule or cancel your appointment, please contact us as soon as possible.</p>
            
            <p>Thank you for choosing GenLunaMedChain for your healthcare needs!</p>
          </div>
          
          <div class="footer">
            <p><strong>GenLunaMedChain</strong></p>
            <p>Your Blockchain-Powered Healthcare Platform</p>
            <p style="margin-top: 10px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  providerNewBooking: (consultation, providerName) => ({
    subject: '🔔 New Consultation Booking - GenLunaMedChain',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-label { font-weight: bold; color: #4b5563; }
          .info-value { color: #1f2937; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 GenLunaMedChain</h1>
            <h2>New Consultation Booking</h2>
          </div>
          
          <div class="content">
            <p>Dear <strong>${providerName}</strong>,</p>
            
            <p>A new consultation has been scheduled with you. Please review the details below:</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #f59e0b;">📅 Appointment Details</h3>
              <div class="info-row">
                <span class="info-label">Date & Time:</span>
                <span class="info-value">${new Date(consultation.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${consultation.scheduled_time}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Consultation Type:</span>
                <span class="info-value">${consultation.consultation_type}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Status:</span>
                <span class="info-value" style="color: #3b82f6; font-weight: bold;">SCHEDULED</span>
              </div>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #3b82f6;">👤 Patient Information</h3>
              <div class="info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${consultation.patient_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Age:</span>
                <span class="info-value">${consultation.patient_age || 'N/A'} years</span>
              </div>
              <div class="info-row">
                <span class="info-label">Gender:</span>
                <span class="info-value">${consultation.patient_gender || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${consultation.patient_phone}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${consultation.patient_email || 'N/A'}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Barangay:</span>
                <span class="info-value">${consultation.patient_barangay.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #ef4444;">🏥 Medical Information</h3>
              <div class="info-row">
                <span class="info-label">Chief Complaint:</span>
                <span class="info-value">${consultation.chief_complaint}</span>
              </div>
              ${consultation.symptoms ? `
              <div class="info-row">
                <span class="info-label">Symptoms:</span>
                <span class="info-value">${consultation.symptoms}</span>
              </div>
              ` : ''}
              ${consultation.medical_history ? `
              <div class="info-row">
                <span class="info-label">Medical History:</span>
                <span class="info-value">${consultation.medical_history}</span>
              </div>
              ` : ''}
              ${consultation.current_medications ? `
              <div class="info-row">
                <span class="info-label">Current Medications:</span>
                <span class="info-value">${consultation.current_medications}</span>
              </div>
              ` : ''}
              ${consultation.allergies ? `
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Allergies:</span>
                <span class="info-value" style="color: #ef4444; font-weight: bold;">${consultation.allergies}</span>
              </div>
              ` : ''}
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #10b981;">🎥 Meeting Details</h3>
              <div class="info-row">
                <span class="info-label">Meeting Link:</span>
                <span class="info-value"><a href="${consultation.meeting_link}">${consultation.meeting_link}</a></span>
              </div>
              <div class="info-row">
                <span class="info-label">Meeting ID:</span>
                <span class="info-value">${consultation.meeting_id}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">Password:</span>
                <span class="info-value">${consultation.meeting_password}</span>
              </div>
            </div>

            <p style="margin-top: 30px;">Please log in to the admin dashboard to confirm or manage this appointment.</p>
          </div>
          
          <div class="footer">
            <p><strong>GenLunaMedChain Admin Portal</strong></p>
            <p>Blockchain-Powered Healthcare Management</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  patientConfirmed: (consultation, providerName) => ({
    subject: '✅ Your Consultation Has Been Confirmed - GenLunaMedChain',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #10b981; }
          .meeting-link { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Consultation Confirmed!</h1>
            <p style="font-size: 18px; margin: 10px 0;">Your healthcare provider has confirmed your appointment</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${consultation.patient_name}</strong>,</p>
            
            <p>Good news! <strong>${providerName}</strong> has confirmed your consultation appointment.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #10b981;">📅 Confirmed Appointment</h3>
              <p><strong>Date & Time:</strong> ${new Date(consultation.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${consultation.scheduled_time}</p>
              <p><strong>Healthcare Provider:</strong> ${providerName}</p>
              
              <div style="text-align: center; margin-top: 20px;">
                <a href="${consultation.meeting_link}" class="meeting-link">Join Video Consultation</a>
              </div>
            </div>

            <p>We look forward to seeing you at your scheduled time!</p>
          </div>
          
          <div class="footer">
            <p><strong>GenLunaMedChain</strong></p>
            <p>Your Blockchain-Powered Healthcare Platform</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  patientCancelled: (consultation, providerName) => ({
    subject: '❌ Consultation Cancelled - GenLunaMedChain',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .info-box { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Consultation Cancelled</h1>
          </div>
          
          <div class="content">
            <p>Dear <strong>${consultation.patient_name}</strong>,</p>
            
            <p>We regret to inform you that your consultation appointment has been cancelled.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #ef4444;">Cancelled Appointment Details</h3>
              <p><strong>Date & Time:</strong> ${new Date(consultation.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${consultation.scheduled_time}</p>
              <p><strong>Healthcare Provider:</strong> ${providerName}</p>
            </div>

            <p>If you did not request this cancellation or would like to reschedule, please contact us or book a new appointment through our platform.</p>
            
            <p>We apologize for any inconvenience this may cause.</p>
          </div>
          
          <div class="footer">
            <p><strong>GenLunaMedChain</strong></p>
            <p>Your Blockchain-Powered Healthcare Platform</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// ============================================
// CORE EMAIL SENDING FUNCTION
// ============================================
export const sendEmail = async (to, subject, html) => {
  try {
    console.log('📧 Email Configuration:');
    console.log('  - Resend Client:', resendClient ? '✅ Available' : '❌ Not Available');
    console.log('  - From Email:', process.env.EMAIL_FROM || process.env.EMAIL_USER);
    console.log('  - To Email:', to);
    
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const fromName = process.env.EMAIL_FROM_NAME || 'GenLunaMedChain';
    
    if (!fromEmail) {
      throw new Error('Email sender not configured (EMAIL_FROM or EMAIL_USER missing)');
    }

    // ============================================
    // PRIORITY 1: RESEND.COM API (RECOMMENDED)
    // ============================================
    if (process.env.RESEND_API_KEY && resendClient) {
      console.log('📧 Using Resend.com API for email delivery');
      
      const data = await resendClient.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: subject,
        html: html,
      });

      console.log('✅ Email sent successfully via Resend.com');
      console.log('📊 Email ID:', data.id);
      
      return { 
        success: true, 
        messageId: data.id,
        provider: 'resend'
      };
    } 
    
    // ============================================
    // FALLBACK: GMAIL SMTP
    // ============================================
    else {
      console.log('⚠️ Resend.com not available, using Gmail SMTP fallback');
      
      const transporter = createGmailTransporter();
      
      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: to,
        subject: subject,
        html: html
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent via Gmail SMTP');
      console.log('📊 Message ID:', info.messageId);
      
      return { 
        success: true, 
        messageId: info.messageId,
        provider: 'gmail-smtp'
      };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('📋 Error details:');
    console.error('  - Message:', error.message);
    console.error('  - Name:', error.name);
    
    // Resend-specific error handling
    if (error.name === 'validation_error') {
      console.error('  - Resend Validation Error:', error.message);
    }
    
    return { 
      success: false, 
      error: error.message, 
      name: error.name
    };
  }
};

// ============================================
// EMAIL HELPER FUNCTIONS
// ============================================

// Send booking confirmation emails to patient and provider
export const sendBookingConfirmation = async (consultation, providerEmail, providerName) => {
  try {
    const results = [];

    // Send to patient if email exists
    if (consultation.patient_email) {
      console.log('📧 Sending booking confirmation to patient:', consultation.patient_email);
      const patientTemplate = emailTemplates.patientBookingConfirmation(consultation, providerName);
      const patientResult = await sendEmail(
        consultation.patient_email,
        patientTemplate.subject,
        patientTemplate.html
      );
      results.push({ recipient: 'patient', email: consultation.patient_email, ...patientResult });
    } else {
      console.log('⚠️ No patient email provided, skipping patient notification');
      results.push({ recipient: 'patient', success: false, error: 'No patient email' });
    }

    // Send to provider
    if (providerEmail) {
      console.log('📧 Sending booking notification to provider:', providerEmail);
      const providerTemplate = emailTemplates.providerNewBooking(consultation, providerName);
      const providerResult = await sendEmail(
        providerEmail,
        providerTemplate.subject,
        providerTemplate.html
      );
      results.push({ recipient: 'provider', email: providerEmail, ...providerResult });
    } else {
      console.log('⚠️ No provider email provided, skipping provider notification');
      results.push({ recipient: 'provider', success: false, error: 'No provider email' });
    }

    return results;
  } catch (error) {
    console.error('❌ Error sending booking confirmation emails:', error);
    return [{ success: false, error: error.message }];
  }
};

// Send consultation confirmed email to patient
export const sendConsultationConfirmed = async (consultation, providerName) => {
  try {
    if (!consultation.patient_email) {
      console.log('⚠️ No patient email, cannot send confirmation');
      return { success: false, error: 'No patient email' };
    }

    console.log('📧 Sending consultation confirmed email to:', consultation.patient_email);
    const template = emailTemplates.patientConfirmed(consultation, providerName);
    return await sendEmail(
      consultation.patient_email,
      template.subject,
      template.html
    );
  } catch (error) {
    console.error('❌ Error sending consultation confirmed email:', error);
    return { success: false, error: error.message };
  }
};

// Send consultation cancelled email to patient
export const sendConsultationCancelled = async (consultation, providerName) => {
  try {
    if (!consultation.patient_email) {
      console.log('⚠️ No patient email, cannot send cancellation notice');
      return { success: false, error: 'No patient email' };
    }

    console.log('📧 Sending consultation cancelled email to:', consultation.patient_email);
    const template = emailTemplates.patientCancelled(consultation, providerName);
    return await sendEmail(
      consultation.patient_email,
      template.subject,
      template.html
    );
  } catch (error) {
    console.error('❌ Error sending consultation cancelled email:', error);
    return { success: false, error: error.message };
  }
};

// Default export for convenience
export default {
  sendEmail,
  sendBookingConfirmation,
  sendConsultationConfirmed,
  sendConsultationCancelled
};