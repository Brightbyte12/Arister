const fs = require('fs');
const path = require('path');
const mjml2html = require('mjml');
const transporter = require("../config/emailTransporter");

const testEmailConnection = async () => {
    try {
        console.log('Testing email connection...');
        console.log('Email config:', {
            user: process.env.EMAIL_USER,
            hasPassword: !!process.env.EMAIL_PASS,
            service: 'gmail'
        });
        
        await transporter.verify();
        console.log('Email connection verified successfully!');
        return true;
    } catch (error) {
        console.error('Email connection test failed:', error);
        return false;
    }
};

const sendOtpEmail = async (email, name, otp, subject) => {
    // Read the MJML template
    const templatePath = path.join(__dirname, 'emailtemp.mjml');
    let mjmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders with actual values
    mjmlTemplate = mjmlTemplate.replace('{{otp}}', otp).replace('{{name}}', name);

    // Convert MJML to HTML
    const { html } = mjml2html(mjmlTemplate);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${email}`);
    } catch (error) {
        console.error(`Error sending OTP email to ${email}:`, error);
        throw new Error("Failed to send OTP email.");
    }
};

const sendOrderEmail = async (email, name, subject, htmlContent) => {
    console.log(`Attempting to send order email to ${email} with subject: ${subject}`);
    console.log('Email configuration check:', {
        user: process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_PASS,
        service: 'gmail'
    });
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: htmlContent,
    };

    try {
        // Test connection first
        await testEmailConnection();
        
        const result = await transporter.sendMail(mailOptions);
        console.log(`Order email sent successfully to ${email}. Message ID: ${result.messageId}`);
        return result;
    } catch (error) {
        console.error(`Error sending order email to ${email}:`, error);
        console.error('Full error details:', {
            message: error.message,
            code: error.code,
            command: error.command
        });
        throw new Error(`Failed to send order email: ${error.message}`);
    }
};

const sendTrackingUpdateEmail = async (emailData) => {
    const { to, orderId, awbCode, courierName, expectedDeliveryDate, trackingUrl, items, total, address } = emailData;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🚚 Your Order is Shipped!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Order #${orderId}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">📦 Tracking Information</h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                        <div>
                            <strong style="color: #666;">AWB Number:</strong><br>
                            <span style="font-size: 18px; font-weight: bold; color: #667eea;">${awbCode}</span>
                        </div>
                        <div>
                            <strong style="color: #666;">Courier:</strong><br>
                            <span style="font-size: 16px; color: #333;">${courierName}</span>
                        </div>
                        <div>
                            <strong style="color: #666;">Expected Delivery:</strong><br>
                            <span style="font-size: 16px; color: #28a745;">${expectedDeliveryDate}</span>
                        </div>
                        <div>
                            <strong style="color: #666;">Status:</strong><br>
                            <span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">Shipped</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${trackingUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                            🔍 Track Your Package
                        </a>
                    </div>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3 style="color: #333; margin-top: 0;">📋 Order Details</h3>
                    <div style="margin: 15px 0;">
                        ${items.map(item => `
                            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <div>
                                    <strong>${item.name}</strong><br>
                                    <small style="color: #666;">Qty: ${item.quantity}</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong>₹${item.price}</strong>
                                </div>
                            </div>
                        `).join('')}
                        <div style="display: flex; justify-content: space-between; padding: 15px 0; border-top: 2px solid #667eea; font-weight: bold; font-size: 18px;">
                            <span>Total:</span>
                            <span>₹${total}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3 style="color: #333; margin-top: 0;">📍 Delivery Address</h3>
                    <p style="margin: 10px 0; line-height: 1.6;">
                        ${address.name}<br>
                        ${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ''}<br>
                        ${address.city}, ${address.state} - ${address.postalCode}<br>
                        ${address.country}
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e8f4fd; border-radius: 8px;">
                    <p style="margin: 0; color: #0c5460;">
                        <strong>Need Help?</strong><br>
                        If you have any questions about your delivery, please contact our support team.
                    </p>
                </div>
            </div>
        </div>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: `🚚 Your Order #${orderId} is Shipped! - AWB: ${awbCode}`,
        html: htmlContent,
    };

    try {
        await testEmailConnection();
        const result = await transporter.sendMail(mailOptions);
        console.log(`Tracking update email sent successfully to ${to}. Message ID: ${result.messageId}`);
        return result;
    } catch (error) {
        console.error(`Error sending tracking update email to ${to}:`, error);
        throw new Error(`Failed to send tracking update email: ${error.message}`);
    }
};

module.exports = {
    sendOtpEmail,
    sendOrderEmail,
    sendTrackingUpdateEmail,
    testEmailConnection
}