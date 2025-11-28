require('dotenv').config();

const INFRA_ID = '16a94217-48f4-4283-a4cc-fb8bcb7084b1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyODE0MDA0LCJpYXQiOjE3NjI4MTA0MDQsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyODEwNDA0fV0sInNlc3Npb25faWQiOiI5YmZiNDI5Mi0wZmQ2LTRmYzAtYjFlMC05MzAxMzI1ZDMzOGYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.bDuskfPN7eW-5sdGLHXGxO2gSJOqvE1psVg3-Aq82Is';

async function test() {
  console.log('\n🗺️  TEST ENDPOINT MAP-DATA\n');
  
  try {
    const response = await fetch(`http://localhost:5000/api/infrastructures/${INFRA_ID}/map-data`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    if (!response.ok) {
      console.error('❌ Erreur:', response.status, response.statusText);
      const text = await response.text();
      console.error(text);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ SUCCÈS !\n');
    console.log('📊 METADATA:');
    console.log(`   Total points: ${data.metadata.totalPoints}`);
    console.log(`   Points actifs: ${data.metadata.activePoints}`);
    console.log(`   Déplacement moyen: ${data.metadata.statistics.averageDisplacement?.toFixed(2)} mm`);
    console.log(`   Déplacement min: ${data.metadata.statistics.minDisplacement?.toFixed(2)} mm`);
    console.log(`   Déplacement max: ${data.metadata.statistics.maxDisplacement?.toFixed(2)} mm\n`);
    
    console.log('🎨 DISTRIBUTION DES RISQUES:');
    console.log(`   Critical: ${data.metadata.riskDistribution.critical}`);
    console.log(`   High: ${data.metadata.riskDistribution.high}`);
    console.log(`   Medium: ${data.metadata.riskDistribution.medium}`);
    console.log(`   Low: ${data.metadata.riskDistribution.low}`);
    console.log(`   Stable: ${data.metadata.riskDistribution.stable}`);
    console.log(`   Unknown: ${data.metadata.riskDistribution.unknown}\n`);
    
    console.log('📍 PREMIERS POINTS:');
    data.features.slice(0, 3).forEach((f, i) => {
      console.log(`\n   ${i + 1}. Point ${f.properties.pointId.substring(0, 8)}...`);
      console.log(`      Coords: [${f.geometry.coordinates[0].toFixed(6)}, ${f.geometry.coordinates[1].toFixed(6)}]`);
      console.log(`      Déplacement: ${f.properties.displacement_mm} mm`);
      console.log(`      Couleur: ${f.properties.color}`);
      console.log(`      Risque: ${f.properties.riskLevel}`);
      console.log(`      Tendance: ${f.properties.trend}`);
      console.log(`      Qualité: ${f.properties.metadata.dataQuality}`);
    });
    
    console.log('\n\n🎉 ENDPOINT FONCTIONNE PARFAITEMENT !\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

test();
