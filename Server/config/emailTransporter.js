// ecommerce-backend/config/emailTransporter.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

console.log('Email configuration check:', {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '***SET***' : '***NOT SET***',
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT
});

let transporter;

// Create a more robust email transporter with fallbacks
const createTransporter = () => {
  // Option 1: Gmail with App Password (recommended)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS, // Use App Password, not regular password
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Test the connection
      gmailTransporter.verify((error, success) => {
        if (error) {
          console.error('Gmail connection failed:', error);
        } else {
          console.log('Gmail transporter ready');
        }
      });
      
      return gmailTransporter;
    } catch (error) {
      console.error('Failed to create Gmail transporter:', error);
    }
  }

  // Option 2: Custom SMTP
  if (process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const smtpTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      console.log('Using custom SMTP transporter');
      return smtpTransporter;
    } catch (error) {
      console.error('Failed to create SMTP transporter:', error);
    }
  }

  // Option 3: Ethereal Email (for testing)
  console.log('No valid email configuration found, using Ethereal for testing');
  return nodemailer.createTransporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'test@ethereal.email',
      pass: 'test123'
    }
  });
};

// Create transporter with retry logic
const createTransporterWithRetry = (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const newTransporter = createTransporter();
      if (newTransporter) {
        return newTransporter;
      }
    } catch (error) {
      console.error(`Attempt ${i + 1} failed to create transporter:`, error);
      if (i === maxRetries - 1) {
        throw new Error('Failed to create email transporter after multiple attempts');
      }
    }
  }
};

try {
  transporter = createTransporterWithRetry();
  console.log('Email transporter created successfully');
} catch (error) {
  console.error('Failed to create email transporter:', error);
  
  // Create a mock transporter that logs emails instead of sending them
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('📧 MOCK EMAIL SENT (no email server configured):');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('HTML Length:', mailOptions.html?.length || 0, 'characters');
      console.log('--- Email Content Preview ---');
      console.log(mailOptions.html?.substring(0, 200) + '...');
      console.log('--- End Email Preview ---');
      
      return {
        messageId: 'mock-' + Date.now(),
        response: 'Mock email sent (no email server)'
      };
    },
    verify: async () => {
      console.log('Mock email transporter verified');
      return true;
    }
  };
  
  console.log('Using mock email transporter - emails will be logged but not sent');
}

module.exports = transporter;