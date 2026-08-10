import { execSync } from 'child_process';
import path from 'path';

export default async function globalTeardown() {
  console.log('Tearing down E2E Docker stack...');
  const composePath = path.resolve(__dirname, '../../docker-compose.e2e.yml');
  execSync(`docker-compose -f "${composePath}" down -v`, { stdio: 'inherit' });
  console.log('E2E Docker stack torn down completely.');
}
