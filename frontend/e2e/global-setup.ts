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
  // Self-contained specs (API mocked in-page) can run without the Docker stack.
  if (process.env.E2E_SKIP_STACK === '1') {
    console.log('E2E_SKIP_STACK=1: skipping Docker stack setup.');
    return;
  }
  console.log('Starting E2E Docker stack...');
  // Adjust the path to docker-compose.e2e.yml based on current working directory
  const composePath = path.resolve(__dirname, '../../docker-compose.e2e.yml');
  execSync(`docker compose -f "${composePath}" up -d --build --wait`, { stdio: 'inherit' });

  // Wait for database readiness
  const connectionString = 'postgresql://erp_user:erp_password@localhost:5433/zero_friction_erp_e2e';
  await waitForDatabase(connectionString);

  // Wait for the Go API (published on 8081) to answer readiness.
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:8081';
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(`${apiUrl}/readyz`);
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (i >= 30) throw new Error('API did not become ready');
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Schema + demo seed are applied by database/e2e/init.sh when the db container first starts.
  console.log('E2E stack ready (db healthy). Test data is seeded per spec.');
}
