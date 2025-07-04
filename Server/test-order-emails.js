const { sendEmail } = require('./utils/email');
const { sendTrackingUpdateEmail } = require('./utils/sendemail');

// Test with a real email address
const testRealEmail = async () => {
    console.log('🧪 Testing Email with Real Address...');
    console.log('=====================================');
    
    // Replace with your actual email address
    const testEmail = 'brightbyte.team@gmail.com'; // Change this to your email
    
    console.log(`Testing with email: ${testEmail}`);
    
    // Test 1: Order Confirmation Email
    console.log('\n1️⃣ Testing Order Confirmation Email...');
    try {
        const orderConfirmationHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🎉 Order Confirmed!</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">Order #ORD123456</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">📋 Order Details</h2>
                        <div style="margin: 15px 0;">
                            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <div>
                                    <strong>Test Product 1</strong><br>
                                    <small style="color: #666;">Qty: 2</small>
                                </div>
                                <div style="text-align: right;">
                                    <strong>₹500</strong>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 15px 0; border-top: 2px solid #667eea; font-weight: bold; font-size: 18px;">
                                <span>Total:</span>
                                <span>₹1000</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h3 style="color: #333; margin-top: 0;">📍 Delivery Address</h3>
                        <p style="margin: 10px 0; line-height: 1.6;">
                            Test User<br>
                            123 Test Street, Apt 4B<br>
                            Test City, Test State - 12345<br>
                            Test Country
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        const result = await sendEmail({
            to: testEmail,
            subject: '🎉 Order Confirmed! - Order #ORD123456',
            html: orderConfirmationHtml
        });
        
        if (result.error) {
            console.log('❌ Order confirmation failed:', result.error);
        } else {
            console.log('✅ Order confirmation email sent successfully!');
        }
    } catch (error) {
        console.log('❌ Order confirmation failed:', error.message);
    }
    
    // Test 2: Shipping Confirmation Email
    console.log('\n2️⃣ Testing Shipping Confirmation Email...');
    try {
        const shippingData = {
            to: testEmail,
            orderId: 'ORD123456',
            awbCode: 'SR123456789',
            courierName: 'Delhivery',
            expectedDeliveryDate: '2024-01-20',
            trackingUrl: 'https://www.delhivery.com/track/package/SR123456789',
            items: [
                { name: 'Test Product 1', quantity: 2, price: 500 },
                { name: 'Test Product 2', quantity: 1, price: 300 }
            ],
            total: 1300,
            address: {
                name: 'Test User',
                addressLine1: '123 Test Street',
                addressLine2: 'Apt 4B',
                city: 'Test City',
                state: 'Test State',
                postalCode: '12345',
                country: 'Test Country'
            }
        };
        
        const result = await sendTrackingUpdateEmail(shippingData);
        
        if (result.error) {
            console.log('❌ Shipping confirmation failed:', result.error);
        } else {
            console.log('✅ Shipping confirmation email sent successfully!');
        }
    } catch (error) {
        console.log('❌ Shipping confirmation failed:', error.message);
    }
    
    // Test 3: Cancellation Email
    console.log('\n3️⃣ Testing Cancellation Email...');
    try {
        const cancellationHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">❌ Order Cancelled</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">Order #ORD123456</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">📋 Cancellation Details</h2>
                        <p style="color: #666; margin: 10px 0;">
                            Your order has been cancelled as requested. The refund process will be initiated shortly.
                        </p>
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <strong>Refund Information:</strong><br>
                            • Refund amount: ₹1300<br>
                            • Processing time: 3-5 business days<br>
                            • You will receive a confirmation email once the refund is processed
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const result = await sendEmail({
            to: testEmail,
            subject: '❌ Order Cancelled - Order #ORD123456',
            html: cancellationHtml
        });
        
        if (result.error) {
            console.log('❌ Cancellation email failed:', result.error);
        } else {
            console.log('✅ Cancellation email sent successfully!');
        }
    } catch (error) {
        console.log('❌ Cancellation email failed:', error.message);
    }
    
    console.log('\n🎯 Email Tests Completed!');
    console.log('Check your email inbox (and spam folder) for the test emails.');
    console.log('If you don\'t receive them, check the console logs above for any errors.');
};

// Run the test
testRealEmail().catch(console.error); 