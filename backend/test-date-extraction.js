const filename = 'S1AA_20241113T055935_20241125T055934_VVP012_INT80_G_ueF_34EF_vert_disp.tif';

console.log('\n🧪 TEST EXTRACTION DE DATE\n');
console.log('Fichier:', filename);
console.log('');

// Test nouveau format (avec timestamp)
const match = filename.match(/S1[AB][AB]_(\d{8})T\d{6}_(\d{8})T\d{6}/);

if (match) {
  const primaryDate = match[1];
  const secondaryDate = match[2];
  
  const year = secondaryDate.substring(0, 4);
  const month = secondaryDate.substring(4, 6);
  const day = secondaryDate.substring(6, 8);
  
  console.log('✅ Match trouvé !');
  console.log('   Date primaire:', primaryDate.substring(6, 8) + '/' + primaryDate.substring(4, 6) + '/' + primaryDate.substring(0, 4));
  console.log('   Date secondaire:', day + '/' + month + '/' + year);
  console.log('   → Date utilisée:', day + '/' + month + '/' + year);
  console.log('');
} else {
  console.log('❌ Pas de match');
  console.log('');
}
