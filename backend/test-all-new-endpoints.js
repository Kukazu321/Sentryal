require('dotenv').config();

const INFRA_ID = '16a94217-48f4-4283-a4cc-fb8bcb7084b1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyODE0MDA0LCJpYXQiOjE3NjI4MTA0MDQsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyODEwNDA0fV0sInNlc3Npb25faWQiOiI5YmZiNDI5Mi0wZmQ2LTRmYzAtYjFlMC05MzAxMzI1ZDMzOGYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.bDuskfPN7eW-5sdGLHXGxO2gSJOqvE1psVg3-Aq82Is';

const BASE_URL = 'http://localhost:5000/api';

async function test() {
  console.log('\n🔥 TEST DES 4 NOUVEAUX ENDPOINTS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allPassed = true;

  // TEST 1: STATISTICS
  console.log('1️⃣  TEST STATISTICS ENDPOINT');
  try {
    const res = await fetch(`${BASE_URL}/infrastructures/${INFRA_ID}/statistics`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('   ✅ Status:', res.status);
      console.log('   ✅ Total points:', data.statistics.overview.totalPoints);
      console.log('   ✅ Active points:', data.statistics.overview.activePoints);
      console.log('   ✅ Avg displacement:', data.statistics.displacement.current.mean?.toFixed(2), 'mm');
      console.log('   ✅ Risk distribution:', JSON.stringify(data.statistics.displacement.distribution));
    } else {
      console.log('   ❌ Error:', res.status, await res.text());
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
    allPassed = false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TEST 2: EXPORT CSV
  console.log('2️⃣  TEST EXPORT CSV ENDPOINT');
  try {
    const res = await fetch(`${BASE_URL}/deformations/export?infrastructureId=${INFRA_ID}&format=csv`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (res.ok) {
      const csv = await res.text();
      const lines = csv.split('\n');
      console.log('   ✅ Status:', res.status);
      console.log('   ✅ Content-Type:', res.headers.get('content-type'));
      console.log('   ✅ Lines:', lines.length);
      console.log('   ✅ Header:', lines[0].substring(0, 80) + '...');
      console.log('   ✅ First row:', lines[1]?.substring(0, 80) + '...');
    } else {
      console.log('   ❌ Error:', res.status, await res.text());
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
    allPassed = false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TEST 3: EXPORT GEOJSON
  console.log('3️⃣  TEST EXPORT GEOJSON ENDPOINT');
  try {
    const res = await fetch(`${BASE_URL}/deformations/export?infrastructureId=${INFRA_ID}&format=geojson`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (res.ok) {
      const geojson = await res.json();
      console.log('   ✅ Status:', res.status);
      console.log('   ✅ Type:', geojson.type);
      console.log('   ✅ Features:', geojson.features.length);
      console.log('   ✅ Total measurements:', geojson.metadata.totalMeasurements);
      if (geojson.features[0]) {
        console.log('   ✅ First feature coords:', geojson.features[0].geometry.coordinates);
        console.log('   ✅ Measurement count:', geojson.features[0].properties.measurementCount);
      }
    } else {
      console.log('   ❌ Error:', res.status, await res.text());
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
    allPassed = false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TEST 4: CREATE SCHEDULE
  console.log('4️⃣  TEST CREATE SCHEDULE ENDPOINT');
  let scheduleId = null;
  try {
    const res = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        infrastructureId: INFRA_ID,
        name: 'Test Schedule - Auto monitoring',
        frequencyDays: 12,
        options: {
          looks: '20x4',
          includeDEM: true
        }
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      scheduleId = data.schedule.id;
      console.log('   ✅ Status:', res.status);
      console.log('   ✅ Schedule ID:', scheduleId.substring(0, 8) + '...');
      console.log('   ✅ Name:', data.schedule.name);
      console.log('   ✅ Frequency:', data.schedule.frequency_days, 'days');
      console.log('   ✅ Is active:', data.schedule.is_active);
      console.log('   ✅ Next run:', new Date(data.schedule.next_run_at).toLocaleString('fr-FR'));
    } else {
      console.log('   ❌ Error:', res.status, await res.text());
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
    allPassed = false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TEST 5: GET SCHEDULES
  console.log('5️⃣  TEST GET SCHEDULES ENDPOINT');
  try {
    const res = await fetch(`${BASE_URL}/schedules`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('   ✅ Status:', res.status);
      console.log('   ✅ Total schedules:', data.count);
      if (data.schedules[0]) {
        console.log('   ✅ First schedule:', data.schedules[0].name);
        console.log('   ✅ Frequency:', data.schedules[0].frequency_days, 'days');
      }
    } else {
      console.log('   ❌ Error:', res.status, await res.text());
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Exception:', error.message);
    allPassed = false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TEST 6: PAUSE SCHEDULE (if created)
  if (scheduleId) {
    console.log('6️⃣  TEST PAUSE SCHEDULE ENDPOINT');
    try {
      const res = await fetch(`${BASE_URL}/schedules/${scheduleId}/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('   ✅ Status:', res.status);
        console.log('   ✅ Message:', data.message);
      } else {
        console.log('   ❌ Error:', res.status, await res.text());
        allPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Exception:', error.message);
      allPassed = false;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // TEST 7: DELETE SCHEDULE (cleanup)
    console.log('7️⃣  TEST DELETE SCHEDULE ENDPOINT (cleanup)');
    try {
      const res = await fetch(`${BASE_URL}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('   ✅ Status:', res.status);
        console.log('   ✅ Message:', data.message);
      } else {
        console.log('   ❌ Error:', res.status, await res.text());
        allPassed = false;
      }
    } catch (error) {
      console.log('   ❌ Exception:', error.message);
      allPassed = false;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // FINAL RESULT
  if (allPassed) {
    console.log('🎉🎉🎉 TOUS LES TESTS PASSÉS ! 🎉🎉🎉\n');
    console.log('✅ Statistics endpoint: FONCTIONNE');
    console.log('✅ Export CSV: FONCTIONNE');
    console.log('✅ Export GeoJSON: FONCTIONNE');
    console.log('✅ Create schedule: FONCTIONNE');
    console.log('✅ Get schedules: FONCTIONNE');
    console.log('✅ Pause schedule: FONCTIONNE');
    console.log('✅ Delete schedule: FONCTIONNE\n');
    console.log('🔥 LES 4 TÂCHES SONT 100% FONCTIONNELLES ! 🔥\n');
  } else {
    console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n');
  }
}

test();
