const http = require('http');

async function test() {
    try {
        // 1. Health Check
        console.log('Testing Health Check...');
        const health = await fetch('http://localhost:5000/health');
        console.log('Health Status:', health.status);
        console.log('Health Body:', await health.json());

        // 2. Register User
        console.log('\nRegistering Test User...');
        const email = `test_${Date.now()}@example.com`;
        const registerRes = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Password123!',
                full_name: 'Test Verify User'
            })
        });
        console.log('Register Status:', registerRes.status);
        const registerData = await registerRes.json();
        console.log('Register Body:', registerData);

        if (!registerData.success) {
            console.error('Registration failed, cannot proceed with reset test.');
            // If user already exists (400), we might still be able to test forgot password on a known email if we knew one.
            // But let's assume success for the unique email.
            return;
        }

        // 3. Forgot Password
        console.log('\nRequesting Password Reset...');
        const forgotRes = await fetch('http://localhost:5000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        console.log('Forgot Password Status:', forgotRes.status);
        const forgotData = await forgotRes.json();
        console.log('Forgot Password Body:', forgotData);

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
