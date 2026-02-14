// src/seeders/adminSeeder.js
require('dotenv').config();
const { supabase } = require('../config/db');

const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@nawaweeb.com';
    const adminPassword = 'Admin@123456';
    const adminFullName = 'Nawaweeb Admin';

    console.log('🔄 Checking if admin user already exists...');

    // Check if admin already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle();

    if (existingProfile) {
      console.log('✅ Admin user already exists!');
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ADMIN CREDENTIALS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    console.log('🔄 Creating new admin user...');

    // Create auth user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminFullName }
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError.message);
      return;
    }

    console.log('✅ Auth user created successfully');

    // Create profile entry with admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: adminEmail,
        full_name: adminFullName,
        role: 'admin',
        is_clan_member: false
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message);
      return;
    }

    console.log('✅ Admin profile created successfully');

    // Display credentials
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ADMIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`User ID: ${profile.id}`);
    console.log(`Role: ${profile.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Seeding error:', error);
  }
};

// Run the seeder
seedAdmin().then(() => {
  console.log('✅ Seeding completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
