// save as debug-login-simple.js
// run with: node debug-login-simple.js

const http = require('http');

// Test credentials from your users.json
const testCredentials = [
    { username: "user1", password: "password1" },
    { username: "user2", password: "password2" },
    { username: "user3", password: "password3" }
];

// Function to make HTTP requests
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                let parsedData;
                
                try {
                    parsedData = responseData ? JSON.parse(responseData) : {};
                } catch (e) {
                    parsedData = { error: 'Invalid JSON', raw: responseData };
                }
                
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: parsedData
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Function to test login
async function testLogin(credentials) {
    console.log(`Testing login with username: ${credentials.username}`);
    
    try {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const response = await makeRequest(options, credentials);
        
        console.log(`Status code: ${response.statusCode}`);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log('Login successful!');
            console.log('Response data:', response.data);
            return true;
        } else {
            console.error('Login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('Request failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\nServer connection refused. Make sure your server is running at http://localhost:3000');
        }
        return false;
    }
}

// Test server connection
async function testServerConnection() {
    console.log('Testing server connection...');
    
    try {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET'
        };
        
        const response = await makeRequest(options);
        console.log(`Server responded with status: ${response.statusCode}`);
        return true;
    } catch (error) {
        console.error('Server connection failed:', error.message);
        return false;
    }
}

// Main function
async function main() {
    console.log('=== Login Debugging Script ===');
    
    // First test server connection
    const isServerUp = await testServerConnection();
    
    if (!isServerUp) {
        console.error('\nCannot connect to server. Please check that:');
        console.error('1. The server is running with: node server.js');
        console.error('2. The server is available at: http://localhost:3000');
        return;
    }
    
    console.log('\nTesting login with each user account:');
    
    let successCount = 0;
    
    for (const credentials of testCredentials) {
        const success = await testLogin(credentials);
        if (success) successCount++;
        console.log('----------------------------');
    }
    
    console.log(`\nResults: ${successCount}/${testCredentials.length} logins successful`);
    
    if (successCount === 0) {
        console.log('\nAll logins failed. Possible issues:');
        console.log('1. Your users.json file might not be loaded correctly');
        console.log('2. The login endpoint might have an implementation error');
        console.log('3. Session management might be misconfigured');
        console.log('\nCheck server logs for more detailed error messages.');
    }
}

main().catch(console.error);