const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwxdnekddmbeskaegdtu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eGRuZWtkZG1iZXNrYWVnZHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjg2ODcsImV4cCI6MjA3Nzg0NDY4N30.wTWsTj2uyv0J6cAZf_qHP1POQjIkOKpBGc-HSPgXrT0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateToken() {
  console.log('🔐 Génération d\'un nouveau token...\n');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'charlie.coupe59@gmail.com',
    password: 'ton_mot_de_passe_ici' // CHANGE MOI
  });
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }
  
  console.log('✅ TOKEN GÉNÉRÉ:\n');
  console.log(data.session.access_token);
  console.log('\n📋 Copie ce token et mets-le dans localStorage !');
  console.log('\nExpire dans:', new Date(data.session.expires_at * 1000).toLocaleString('fr-FR'));
}

generateToken();
