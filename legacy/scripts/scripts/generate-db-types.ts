// Types and relationships are derived from the migrations in disposable PostgreSQL.
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { testDatabase } from '../tests/integration/database';

const db = await testDatabase();
try {
  const enums = (
    await db.pool.query(
      "select t.typname,e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' order by t.typname,e.enumsortorder",
    )
  ).rows;
  const enumTypes = new Map<string, string>();
  for (const e of enums)
    enumTypes.set(
      e.typname,
      [enumTypes.get(e.typname), JSON.stringify(e.enumlabel)].filter(Boolean).join(' | '),
    );
  const type = (pg: string): string => {
    if (pg.endsWith('[]')) return `(${type(pg.slice(0, -2))})[]`;
    if (enumTypes.has(pg.replace(/^public\./, '')))
      return enumTypes.get(pg.replace(/^public\./, ''))!;
    if (/^(smallint|integer|bigint|numeric|double precision|real)$/.test(pg)) return 'number';
    if (pg === 'boolean') return 'boolean';
    if (pg === 'jsonb' || pg === 'json') return 'Json';
    if (pg === 'void') return 'undefined';
    return 'string';
  };
  const columns = (
    await db.pool
      .query(`select c.relname as table_name,a.attname as column_name,format_type(a.atttypid,a.atttypmod) as pg_type,
   a.attnotnull as required,pg_get_expr(d.adbin,d.adrelid) as default_value
   from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
   left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
   where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`)
  ).rows;
  const relationships = (
    await db.pool.query(`select c.relname as table_name,k.conname,
   array(select a.attname::text from unnest(k.conkey) with ordinality v(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=v.num order by v.ord) as columns,
   f.relname as target,
   array(select a.attname::text from unnest(k.confkey) with ordinality v(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=v.num order by v.ord) as target_columns,
   exists(select 1 from pg_constraint u where u.conrelid=k.conrelid and u.contype in ('p','u') and u.conkey=k.conkey) as one_to_one
   from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
   join pg_class f on f.oid=k.confrelid join pg_namespace fn on fn.oid=f.relnamespace
   where k.contype='f' and n.nspname='public' and fn.nspname='public' order by c.relname,k.conname`)
  ).rows;
  const tableNames = [...new Set(columns.map((c) => String(c.table_name)))];
  const tables = tableNames
    .map((name) => {
      const cols = columns.filter((c) => c.table_name === name);
      const fields = (mode: 'Row' | 'Insert' | 'Update') =>
        cols
          .map(
            (c) =>
              `${JSON.stringify(c.column_name)}${mode === 'Update' || (mode === 'Insert' && (!c.required || c.default_value !== null)) ? '?' : ''}: ${type(c.pg_type)}${c.required ? '' : ' | null'}`,
          )
          .join(';');
      const rels = relationships
        .filter((r) => r.table_name === name)
        .map(
          (r) =>
            `{foreignKeyName:${JSON.stringify(r.conname)};columns:${JSON.stringify(r.columns)};isOneToOne:${r.one_to_one};referencedRelation:${JSON.stringify(r.target)};referencedColumns:${JSON.stringify(r.target_columns)}}`,
        )
        .join(',');
      return `${JSON.stringify(name)}:{Row:{${fields('Row')}};Insert:{${fields('Insert')}};Update:{${fields('Update')}};Relationships:[${rels}]}`;
    })
    .join(';');
  const jsonReturns: Record<string, string> = {
    account_state: 'AccountState',
    profile_stats: 'ProfileStats',
    admin_metrics: 'Metrics',
    member_summary: 'MemberSummary',
    admin_operations: 'Operations',
  };
  const functions = (
    await db.pool
      .query(`select p.proname,p.proargnames,p.proargmodes::text[] as proargmodes,p.pronargdefaults,p.proretset,format_type(p.prorettype,null) as return_type,
   array(select format_type(t,null) from unnest(coalesce(p.proallargtypes,p.proargtypes::oid[])) t) as arg_types,
   pg_get_function_arguments(p.oid) as definition
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`)
  ).rows;
  const fns = functions
    .map((f) => {
      const modes: string[] = f.proargmodes || f.arg_types.map(() => 'i');
      const input = modes.map((m, i) => ({ m, i })).filter((v) => v.m === 'i' || v.m === 'b');
      const args = input
        .map((v, index) => {
          const name = f.proargnames[v.i];
          const nullable = new RegExp(`\\b${name}\\b[^,]*DEFAULT NULL`, 'i').test(f.definition);
          return `${name}${index >= input.length - f.pronargdefaults ? '?' : ''}: ${type(f.arg_types[v.i])}${nullable ? ' | null' : ''}`;
        })
        .join(';');
      const output = modes.map((m, i) => ({ m, i })).filter((v) => v.m === 't' || v.m === 'o');
      let returns =
        jsonReturns[f.proname] ||
        (output.length
          ? `{${output.map((v) => `${f.proargnames[v.i]}:${type(f.arg_types[v.i])}${(f.proname === 'admin_accounts' && ['username', 'display_name'].includes(f.proargnames[v.i])) || (f.proname === 'city_ranking' && f.proargnames[v.i] === 'avatar_url') ? ' | null' : ''}`).join(';')}}`
          : tableNames.includes(f.return_type.replace(/^public\./, ''))
            ? `Database['public']['Tables'][${JSON.stringify(f.return_type.replace(/^public\./, ''))}]['Row']`
            : type(f.return_type));
      if (f.proretset) returns = `(${returns})[]`;
      return `${f.proname}:{Args:${input.length ? `{${args}}` : 'Record<string, never>'};Returns:${returns}}`;
    })
    .join(';');
  const source = await format(
    `// Generated from supabase/migrations. Run npm run db:types; do not edit by hand.\nimport type {Json,AccountState,ProfileStats,Metrics,MemberSummary,Operations} from '@/lib/types';\nexport type {Json};\nexport type Database={public:{Tables:{${tables}};Views:Record<string,never>;Functions:{${fns}};Enums:{${[...enumTypes].map(([name, union]) => `${name}:${union}`).join(';')}};CompositeTypes:Record<string,never>}};`,
    { parser: 'typescript', singleQuote: true, printWidth: 92 },
  );
  const path = 'src/lib/supabase/database.types.ts';
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== source)
      throw new Error('Tipos do banco desatualizados. Execute npm run db:types.');
    console.log('Tipos e relacionamentos correspondem às migrations.');
  } else {
    await writeFile(path, source);
    console.log('Tipos e relacionamentos gerados a partir do PostgreSQL.');
  }
} finally {
  await db.stop();
}
