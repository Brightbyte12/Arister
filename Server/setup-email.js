const fs = require('fs');
const path = require('path');

console.log('🔧 Email Setup Helper');
console.log('=====================================');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log('Current Email Configuration:');
console.log('- EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : '***NOT SET***');
console.log('- ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'NOT SET');
console.log('- .env file exists:', envExists);

if (!envExists) {
    console.log('\n📝 Creating .env file...');
    
    const envContent = `# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
ADMIN_EMAIL=admin@yourdomain.com

# Other configurations...
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
SHIPROCKET_EMAIL=your-shiprocket-email
SHIPROCKET_PASSWORD=your-shiprocket-password
SHIPROCKET_WAREHOUSE_PINCODE=your-warehouse-pincode
SHIPROCKET_API_USER=your-shiprocket-api-user
SHIPROCKET_API_PASSWORD=your-shiprocket-api-password
SHIPROCKET_COMPANY_ID=your-company-id

# Client URL (for emails, etc.)
CLIENT_URL=https://aristerfront.onrender.com/
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created!');
    console.log('📝 Please edit the .env file with your actual values');
} else {
    console.log('\n📝 .env file already exists');
    console.log('📝 Please check if EMAIL_USER, EMAIL_PASS, and ADMIN_EMAIL are set correctly');
}

console.log('\n📋 Email Setup Instructions:');
console.log('=====================================');
console.log('1. Gmail Setup (Recommended):');
console.log('   - Go to your Google Account settings');
console.log('   - Enable 2-Factor Authentication');
console.log('   - Generate an App Password:');
console.log('     * Go to Security → App passwords');
console.log('     * Select "Mail" and "Other (Custom name)"');
console.log('     * Name it "E-commerce App"');
console.log('     * Copy the 16-character password');
console.log('');
console.log('2. Update .env file:');
console.log('   - Set EMAIL_USER to your Gmail address');
console.log('   - Set EMAIL_PASS to the 16-character app password');
console.log('   - Set ADMIN_EMAIL to your admin email address');
console.log('');
console.log('3. Test the email functionality:');
console.log('   - Run: node test-email.js');
console.log('   - Run: node test-order-emails.js');
console.log('');
console.log('4. Check your email inbox and spam folder for test emails');

console.log('\n🔍 Troubleshooting:');
console.log('=====================================');
console.log('• If emails are not received, check spam/junk folder');
console.log('• Make sure you\'re using App Password, not regular password');
console.log('• Verify the email address is correct in the database');
console.log('• Check server console logs for email errors');
console.log('• The system will use mock emails if no email server is configured');

console.log('\n📧 Email Types Available:');
console.log('=====================================');
console.log('✅ Order Confirmation - Sent when user places order');
console.log('✅ Order Processing - Sent when admin creates Shiprocket order');
console.log('✅ Shipping Confirmation - Sent when courier is assigned (AWB)');
console.log('✅ Cancellation Request - Sent to admin when user requests cancellation');
console.log('✅ Cancellation Response - Sent to user when admin approves/rejects');
console.log('✅ Order Cancelled - Sent when admin directly cancels order');

console.log('\n🎯 Next Steps:');
console.log('=====================================');
console.log('1. Update your .env file with correct email credentials');
console.log('2. Restart your server');
console.log('3. Test email functionality with the test scripts');
console.log('4. Place a test order to verify order confirmation emails');
console.log('5. Use admin panel to test cancellation and shipping emails'); 
