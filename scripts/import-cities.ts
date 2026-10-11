import { cityMigration, writeCityMigration, cityChanges } from './lib/cities-migration';

const response = await fetch(
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
  { signal: AbortSignal.timeout(30000) },
);
if (!response.ok) throw new Error('IBGE indisponível');
const result = cityMigration(await response.json());
console.log(
  `${result.total} municípios, ${result.states} UFs. Municípios antigos não são excluídos automaticamente.`,
);
const changes = await cityChanges('supabase/migrations', result.sql);
console.log(
  `Comparado às migrations locais: ${changes.added} novos, ${changes.updated} alterados, ${changes.unchanged} sem alteração e ${changes.retained} antigos preservados.`,
);
if (process.argv.includes('--dry-run')) console.log('Prévia concluída: nenhum arquivo alterado.');
else
  console.log(
    `Nova migration: ${await writeCityMigration('supabase/migrations', result.sql)}. Revise antes de aplicar.`,
  );
