import { test, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { testDatabase } from './database';
import { statements } from '../../scripts/lib/migrations';
const exec = promisify(execFile);
test('importação preserva IDs, senhas, fotos e vínculos; dump SQL restaura em banco vazio', async () => {
  const fixture = await testDatabase(),
    directory = await mkdtemp(join(tmpdir(), 'goindica-import-'));
  try {
    const alice = randomUUID(),
      bob = randomUUID(),
      request = randomUUID(),
      place = randomUUID(),
      indication = randomUUID(),
      resolution = randomUUID(),
      reward = randomUUID();
    const now = '2026-10-14T12:00:00.000Z';
    const jpeg = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ec5e27' },
    })
      .jpeg()
      .toBuffer();
    const source = {
      version: 1,
      users: [
        {
          id: alice,
          email: 'alice@test.invalid',
          password_hash: '$2b$10$legacyhash',
          email_confirmed_at: now,
          created_at: now,
        },
        {
          id: bob,
          email: 'bob@test.invalid',
          password_hash: '$2b$10$legacyhash',
          email_confirmed_at: now,
          created_at: now,
        },
      ],
      accounts: [
        { id: alice, blocked: false, is_admin: true, created_at: now },
        { id: bob, blocked: false, is_admin: false, created_at: now },
      ],
      profiles: [
        {
          id: alice,
          username: 'alice',
          display_name: 'Alice',
          home_city_id: 3549805,
          avatar_url: 'https://lh3.googleusercontent.com/source',
        },
        {
          id: bob,
          username: 'bobby',
          display_name: 'Bob',
          home_city_id: 3549805,
          avatar_url: null,
        },
      ],
      profile_photos: [{ user_id: alice, jpeg_base64: jpeg.toString('base64') }],
      requests: [
        {
          id: request,
          requester_id: alice,
          description: 'Café especial do bairro',
          city_id: 3549805,
          status: 'RESOLVED',
          indication_count: 1,
          responses_revealed_at: now,
          created_at: now,
          has_photo: true,
          photo_updated_at: now,
        },
      ],
      places: [
        { id: place, google_place_id: 'legacy_place_id', city_id: 3549805, last_verified_at: now },
      ],
      indications: [
        {
          id: indication,
          request_id: request,
          user_id: bob,
          place_id: place,
          comment: 'Comprei no local',
          created_at: now,
        },
      ],
      request_resolutions: [
        {
          id: resolution,
          request_id: request,
          type: 'INDICATED_PLACE',
          place_id: place,
          resolved_by: alice,
          created_at: now,
        },
      ],
      reward_events: [
        {
          id: reward,
          user_id: bob,
          request_id: request,
          indication_id: indication,
          city_id: 3549805,
          points: 10,
          created_at: now,
        },
      ],
      audit_logs: [
        {
          id: randomUUID(),
          actor_id: alice,
          event_type: 'REQUEST_RESOLVED',
          entity_type: 'REQUEST',
          entity_id: request,
          metadata: { type: 'INDICATED_PLACE' },
          created_at: now,
        },
      ],
      request_photos: [
        { request_id: request, jpeg_base64: jpeg.toString('base64'), updated_at: now },
      ],
    };
    const file = join(directory, 'source.json');
    await writeFile(file, JSON.stringify(source), { mode: 0o600 });
    const args = ['node_modules/tsx/dist/cli.mjs', 'scripts/import-mysql.ts', '--input=' + file];
    const env = { ...process.env, ...fixture.env };
    await exec(process.execPath, args, { env });
    const [rewards] = await fixture.pool.query<RowDataPacket[]>(
      'SELECT user_id,points,created_at FROM reward_events',
    );
    expect(rewards[0].user_id).toBe(bob);
    expect(rewards[0].points).toBe(10);
    expect(rewards[0].created_at.toISOString()).toBe(now);
    const [places] = await fixture.pool.query<RowDataPacket[]>(
      'SELECT legacy_google_place_id FROM places',
    );
    expect(places[0].legacy_google_place_id).toBe('legacy_place_id');
    const [profiles] = await fixture.pool.query<RowDataPacket[]>(
      'SELECT avatar_url FROM profiles WHERE id=?',
      [alice],
    );
    expect(profiles[0].avatar_url).toBe('/api/profile-photo?id=' + alice);
    const [photos] = await fixture.pool.query<RowDataPacket[]>('SELECT jpeg FROM request_photos');
    expect(photos[0].jpeg.equals(jpeg)).toBe(true);
    await expect(exec(process.execPath, args, { env })).rejects.toThrow();
    const sqlFile = join(directory, 'hostinger.sql');
    await exec(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/export-mysql-sql.ts', '--output=' + sqlFile],
      { env },
    );
    await fixture.pool.query(
      'CREATE DATABASE goindica_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    const restored = await mysql.createConnection({
      host: env.MYSQL_HOST,
      port: Number(env.MYSQL_PORT),
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: 'goindica_restore_test',
      timezone: 'Z',
    });
    try {
      for (const statement of statements(await readFile(sqlFile, 'utf8')))
        await restored.query(statement);
      const [copied] = await restored.query<RowDataPacket[]>(
        'SELECT id,points,created_at FROM reward_events',
      );
      expect(copied[0].id).toBe(reward);
      expect(copied[0].created_at.toISOString()).toBe(now);
      await expect(restored.execute('UPDATE reward_events SET points=20')).rejects.toThrow(
        'IMMUTABLE_LEDGER',
      );
    } finally {
      await restored.end();
    }
  } finally {
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
