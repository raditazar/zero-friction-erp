import { execSync } from 'child_process';
import { Client } from 'pg';
import path from 'path';

async function waitForDatabase(connectionString: string, maxRetries = 10, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      console.log('Database is ready');
      return;
    } catch (e) {
      console.log(`Waiting for database to be ready... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Database connection failed after maximum retries');
}

export default async function globalSetup() {
  console.log('Starting E2E Docker stack...');
  // Adjust the path to docker-compose.e2e.yml based on current working directory
  const composePath = path.resolve(__dirname, '../../docker-compose.e2e.yml');
  execSync(`docker-compose -f "${composePath}" up -d`, { stdio: 'inherit' });

  // Wait for database readiness
  const connectionString = 'postgresql://erp_user:erp_password@localhost:5433/zero_friction_erp_e2e';
  await waitForDatabase(connectionString);

  // Run DB migrations and seed data
  console.log('Running database migrations and seeding test data...');
  // Currently mock commands since real backend tools might not be available or set up here
  // execSync('go run scripts/migrate.go ...', { stdio: 'inherit' })
  console.log('Mock: Migrations applied successfully.');
  
  // Connect directly to seed if needed
  const client = new Client({ connectionString });
  await client.connect();
  
  // Seed essential test data (user, wallet)
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50), email VARCHAR(50));
    CREATE TABLE IF NOT EXISTS wallets (id SERIAL PRIMARY KEY, user_id INT, balance NUMERIC);
    CREATE TABLE IF NOT EXISTS sessions (id VARCHAR(255) PRIMARY KEY, user_id INT, data TEXT);
    
    INSERT INTO users (username, email) VALUES ('testuser', 'test@example.com') ON CONFLICT DO NOTHING;
    INSERT INTO wallets (user_id, balance) VALUES (1, 1000.00) ON CONFLICT DO NOTHING;
    INSERT INTO sessions (id, user_id, data) VALUES ('mock-session-id', 1, '{}') ON CONFLICT DO NOTHING;
  `);
  
  await client.end();
  
  console.log('Test data seeded.');

  // Optionally set env var for the session cookie to be injected into tests
  process.env.E2E_MOCK_SESSION_COOKIE = 'mock-session-id';
}
