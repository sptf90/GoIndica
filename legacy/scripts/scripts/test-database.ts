import { testDatabase } from '../tests/integration/database';
const db = await testDatabase();
try {
  const result = await db.pool.query('select count(*)::int as count from public.cities');
  console.log(`Migrations aplicadas em PostgreSQL real: ${result.rows[0].count} cidades.`);
} finally {
  await db.stop();
}
