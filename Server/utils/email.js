const transporter = require("../config/emailTransporter");

const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"E-commerce Store" <${process.env.EMAIL_USER || 'noreply@example.com'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    console.log('📧 Sending email:', {
      to: options.to,
      subject: options.subject,
      htmlLength: options.html?.length || 0
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    // Don't throw error to prevent order processing from failing
    // Just log the error and continue
    return { error: error.message };
  }
};

module.exports = { sendEmail };