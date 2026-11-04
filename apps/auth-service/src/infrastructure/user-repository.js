import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });

export async function findByUsername(username) {
  const result = await pool.query(
    `SELECT u.uid, u.username, u.password_hash, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.username = $1`,
    [username],
  );
  return result.rows[0] || null;
}

export async function createUser(client, { username, passwordHash, role = 'CUSTOMER' }) {
  const result = await client.query(
    `INSERT INTO users(username, password_hash, role_id)
     SELECT $1, $2, role_id FROM roles WHERE role_name = $3
     RETURNING uid, username`,
    [username, passwordHash, role],
  );
  return result.rows[0];
}

export async function seedAdmin(passwordHash) {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  await pool.query(
    `INSERT INTO users(username, password_hash, role_id)
     SELECT $1, $2, role_id FROM roles WHERE role_name = 'ADMIN'
     ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash],
  );
}

