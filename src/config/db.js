const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || '';

const pool = connectionString
    ? new Pool({
          connectionString,
          ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      })
    : new Pool({
          user: process.env.DB_USER || 'postgres',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'careledger',
          password: process.env.DB_PASSWORD || 'postgres',
          port: process.env.DB_PORT || 5432,
      });

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
});

module.exports = pool;
