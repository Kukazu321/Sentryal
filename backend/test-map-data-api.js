// Test the actual API endpoint to see the error
const fetch = require('node-fetch');

const INFRA_ID = '58335d08-1897-41c1-a1b1-9e7dbbda4f61';
const API_URL = `http://localhost:5000/api/infrastructures/${INFRA_ID}/map-data`;

// You'll need to get a valid JWT token from your frontend
// For now, we'll test without auth to see if it's an auth issue or a data issue
async function testAPI() {
  try {
    console.log('🔍 Testing API endpoint:', API_URL);
    
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add your JWT token here if needed
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      }
    });
    
    console.log('📊 Status:', response.status, response.statusText);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('📄 Response body:', text.substring(0, 500));
    
    if (response.ok) {
      try {
        const json = JSON.parse(text);
        console.log('✅ JSON parsed successfully');
        console.log('📊 Features count:', json.features?.length || 0);
        console.log('📊 Total points:', json.metadata?.totalPoints || 0);
      } catch (e) {
        console.log('❌ Failed to parse JSON:', e.message);
      }
    } else {
      console.log('❌ Request failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAPI();

