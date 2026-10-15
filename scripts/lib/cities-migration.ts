import { z } from 'zod';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const uf = z.object({ sigla: z.string().regex(/^[A-Z]{2}$/), nome: z.string().min(2) });
const municipalities = z.array(
  z.object({
    id: z.number().int().positive(),
    nome: z.string().min(2),
    microrregiao: z
      .object({ mesorregiao: z.object({ UF: uf }) })
      .nullable()
      .optional(),
    'regiao-imediata': z.object({ 'regiao-intermediaria': z.object({ UF: uf }) }).optional(),
  }),
);
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function cityMigration(input: unknown, now = new Date(), minimum = 5500) {
  const rows = municipalities.parse(input);
  if (rows.length < minimum || new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new Error('Catálogo IBGE incompleto ou com identificadores duplicados.');
  const states = new Set<string>();
  const values = rows.map((r) => {
    const state =
      r.microrregiao?.mesorregiao.UF || r['regiao-imediata']?.['regiao-intermediaria'].UF;
    if (!state) throw new Error('Município sem UF estruturada.');
    states.add(state.sigla);
    return `(${r.id},${quote(r.nome)},${quote(normalize(r.nome))},${quote(state.nome)},${quote(state.sigla)},${quote(normalize(r.nome).replaceAll(' ', '-') + '-' + state.sigla.toLowerCase())})`;
  });
  return {
    total: rows.length,
    states: states.size,
    sql: `-- Municípios oficiais do IBGE. Atualizado em ${now.toISOString().slice(0, 10)}.\ninsert into cities(id,name,normalized_name,state_name,state_code,slug) values\n${values.join(',\n')}\nON DUPLICATE KEY UPDATE name=VALUES(name),normalized_name=VALUES(normalized_name),state_name=VALUES(state_name),state_code=VALUES(state_code),slug=VALUES(slug);\n`,
  };
}

export async function cityChanges(directory: string, sql: string) {
  const tuples = (source: string) =>
    new Map(
      [...source.matchAll(/^\((\d+),('(?:[^']|'')*'(?:,'(?:[^']|'')*'){4})\)[,;]?$/gm)].map(
        (match) => [Number(match[1]), match[2]],
      ),
    );
  const previous = new Map<number, string>();
  for (const file of (await readdir(directory)).filter((f) => /cities\.sql$/.test(f)).sort())
    for (const [id, row] of tuples(await readFile(join(directory, file), 'utf8')))
      previous.set(id, row);
  const next = tuples(sql);
  let added = 0,
    updated = 0,
    unchanged = 0;
  for (const [id, row] of next) {
    if (!previous.has(id)) added++;
    else if (previous.get(id) !== row) updated++;
    else unchanged++;
  }
  return {
    added,
    updated,
    unchanged,
    retained: [...previous.keys()].filter((id) => !next.has(id)).length,
  };
}

export async function writeCityMigration(directory: string, sql: string, now = new Date()) {
  const files = await readdir(directory);
  const latest = files
    .map((f) => /^([0-9]{12,14})_/.exec(f)?.[1]?.padEnd(14, '0'))
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  let instant = now;
  if (latest) {
    const lastDate = new Date(
      `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}T${latest.slice(8, 10)}:${latest.slice(10, 12)}:${latest.slice(12, 14)}Z`,
    );
    if (lastDate >= instant) instant = new Date(lastDate.getTime() + 1000);
  }
  for (;;) {
    const stamp = instant
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    const path = join(directory, stamp + '_update_cities.sql');
    try {
      await writeFile(path, sql, { flag: 'wx' });
      return path;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
        throw error;
      instant = new Date(instant.getTime() + 1000);
    }
  }
}
