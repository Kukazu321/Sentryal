const TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyODQ4OTE2LCJpYXQiOjE3NjI4NDUzMTYsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyODQ1MzE2fV0sInNlc3Npb25faWQiOiJlMjljODM1Ni0xZjY2LTRjZmEtOTM5MS1hOGIzYWExYjkzZGUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.6TK2fCQzA3zrvZgChloYXmw8rZlz8K51Fmp2_7QQwQI';
const INFRA_ID = '16a94217-48f4-4283-a4cc-fb8bcb7084b1';

async function test() {
  console.log('🔍 Test map-data endpoint\n');
  
  const res = await fetch(`http://localhost:5000/api/infrastructures/${INFRA_ID}/map-data`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  
  if (!res.ok) {
    console.error('❌ Error:', res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  
  console.log('✅ Response received\n');
  console.log('📊 METADATA STRUCTURE:');
  console.log(JSON.stringify(data.metadata, null, 2));
  
  console.log('\n📍 FIRST FEATURE:');
  console.log(JSON.stringify(data.features[0], null, 2));
}

test();
