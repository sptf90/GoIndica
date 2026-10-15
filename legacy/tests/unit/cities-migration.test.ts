import { test, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cityMigration, writeCityMigration, cityChanges } from '../../scripts/lib/cities-migration';

test('atualização cria versões novas, preserva migration aplicada e escapa nomes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cities-migration-'));
  try {
    const original = join(directory, '202610040002_cities.sql');
    await writeFile(original, 'migration aplicada');
    const now = new Date('2026-10-07T12:00:00Z');
    const result = cityMigration(
      [
        {
          id: 1,
          nome: "Olho d'Água",
          microrregiao: null,
          'regiao-imediata': { 'regiao-intermediaria': { UF: { sigla: 'SP', nome: 'São Paulo' } } },
        },
      ],
      now,
      1,
    );
    const first = await writeCityMigration(directory, result.sql, now);
    const second = await writeCityMigration(directory, result.sql, now);
    expect(first).not.toBe(second);
    expect(await readFile(original, 'utf8')).toBe('migration aplicada');
    expect(await readdir(directory)).toHaveLength(3);
    expect(result.sql).toContain("Olho d''Água");
    expect(result.sql).toContain('2026-10-07');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resumo distingue inclusão, alteração e município antigo preservado', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cities-summary-'));
  try {
    const row = (id: number, nome: string) => ({
      id,
      nome,
      microrregiao: { mesorregiao: { UF: { sigla: 'SP', nome: 'São Paulo' } } },
    });
    await writeFile(
      join(directory, '202610040002_cities.sql'),
      cityMigration([row(1, 'Primeira'), row(2, 'Antiga')], new Date(), 1).sql,
    );
    const next = cityMigration(
      [row(1, 'Primeira atualizada'), row(3, "Olho d'Água")],
      new Date(),
      1,
    ).sql;
    expect(await cityChanges(directory, next)).toEqual({
      added: 1,
      updated: 1,
      unchanged: 0,
      retained: 1,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejeita catálogo incompleto, duplicado ou sem UF', () => {
  expect(() => cityMigration([])).toThrow();
  const row = {
    id: 1,
    nome: 'Cidade',
    microrregiao: { mesorregiao: { UF: { sigla: 'SP', nome: 'São Paulo' } } },
  };
  expect(() => cityMigration([row, row], new Date(), 1)).toThrow('duplicados');
  expect(() => cityMigration([{ id: 1, nome: 'Cidade' }], new Date(), 1)).toThrow('UF');
});
