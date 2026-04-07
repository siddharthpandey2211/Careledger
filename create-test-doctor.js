const {Pool}=require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({connectionString:'postgresql://postgres.wldwgqnabieyyamwjliy:xa9huHyULG6yQLYT@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres'});

(async()=>{
  try {
    const hashedPwd = await bcrypt.hash('TestDoc123!', 12);
    const userRes = await pool.query(
      'INSERT INTO users (email, phone, password_hash, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, role',
      ['testdoctor@careledger.com', '9876543210', hashedPwd, 'doctor']
    );
    const userId = userRes.rows[0].id;
    console.log('✓ Test user created:', userRes.rows[0]);

    const doctorRes = await pool.query(
      'INSERT INTO doctors (user_id, full_name, license_number, specialization, is_verified, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, user_id, full_name, is_verified',
      [userId, 'Dr. Test Doctor', 'LIC123456', 'General Medicine', true]
    );
    console.log('✓ Doctor profile created (VERIFIED):', doctorRes.rows[0]);
    console.log('\n📋 Login credentials:');
    console.log('Email: testdoctor@careledger.com');
    console.log('Phone: 9876543210');
    console.log('Password: TestDoc123!');
  } catch(e){
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
