import 'server-only';
import { z } from 'zod';
import { pool, rows, type Executor, type SqlRow } from '@/lib/database/pool';
import { optionalEnv } from '@/lib/env';
export interface CnpjData {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  registrationStatus: string | null;
  cityId: number | null;
  branch: 'MATRIZ' | 'FILIAL' | null;
}
export type CnpjLookup =
  { status: 'found'; data: CnpjData } | { status: 'not_found' } | { status: 'unavailable' };
export interface Company extends SqlRow {
  account_id: string;
  cnpj: string;
  legal_name: string;
  trade_name: string | null;
  display_name: string;
  registration_status: string | null;
  city_id: number | null;
  branch: 'MATRIZ' | 'FILIAL' | null;
  data_source: 'RECEITA' | 'MANUAL';
  data_checked_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface NewCompany {
  cnpj: string;
  displayName: string;
  legalName: string;
  data: CnpjData | null;
}
const response = z.object({
  razao_social: z.string().trim().min(2),
  nome_fantasia: z.string().nullish(),
  descricao_situacao_cadastral: z.string().nullish(),
  codigo_municipio_ibge: z.coerce.number().int().nullish(),
  descricao_identificador_matriz_filial: z.string().nullish(),
});
const clip = (value: string | null | undefined, size: number) =>
  value?.trim().replace(/\s+/g, ' ').slice(0, size) || null;
export const isActive = (data: CnpjData) => data.registrationStatus?.toUpperCase() === 'ATIVA';
interface LookupRow extends SqlRow {
  found: boolean;
  legal_name: string | null;
  trade_name: string | null;
  registration_status: string | null;
  city_id: number | null;
  branch: 'MATRIZ' | 'FILIAL' | null;
}
// A BrasilAPI responde 403 a requisições sem User-Agent identificado.
const providers = () =>
  (optionalEnv('CNPJ_API_URL') || 'https://brasilapi.com.br/api/cnpj/v1/,https://minhareceita.org/')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
type Fetched = { status: 'found'; body: z.infer<typeof response> } | { status: 'not_found' } | null;
async function fetchFrom(url: string, cnpj: string): Promise<Fetched> {
  const started = performance.now();
  let result: Response;
  try {
    result = await fetch(url + cnpj, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GoIndica/1.0 (+https://goindica.com.br)',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    return unavailable(url, started, 0);
  }
  if (result.status === 404) return { status: 'not_found' };
  const parsed = result.ok ? response.safeParse(await result.json().catch(() => null)) : null;
  if (!parsed?.success) return unavailable(url, started, result.status);
  return { status: 'found', body: parsed.data };
}
// Dados públicos da Receita via BrasilAPI, com a Minha Receita como alternativa. Respostas válidas
// ficam em cache: 7 dias quando o CNPJ existe e 1 dia quando não existe. Indisponibilidade nunca é
// armazenada.
export async function lookupCnpj(cnpj: string, fresh = false): Promise<CnpjLookup> {
  if (!fresh) {
    const [cached] = await rows<LookupRow>(
      pool(),
      'SELECT * FROM cnpj_lookups WHERE cnpj=? AND fetched_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL IF(found,7,1) DAY)',
      [cnpj],
    );
    if (cached) return fromRow(cnpj, cached);
  }
  let fetched: Fetched = null;
  for (const url of providers()) {
    fetched = await fetchFrom(url, cnpj);
    if (fetched) break;
  }
  if (!fetched) return { status: 'unavailable' };
  if (fetched.status === 'not_found') {
    await store(cnpj, null);
    return { status: 'not_found' };
  }
  const { body } = fetched;
  const city = body.codigo_municipio_ibge;
  const known =
    city && (await rows(pool(), 'SELECT id FROM cities WHERE id=?', [city])).length ? city : null;
  const branch = body.descricao_identificador_matriz_filial?.toUpperCase();
  const data: CnpjData = {
    cnpj,
    legalName: clip(body.razao_social, 160)!,
    tradeName: clip(body.nome_fantasia, 160),
    registrationStatus: clip(body.descricao_situacao_cadastral, 40),
    cityId: known,
    branch: branch === 'MATRIZ' || branch === 'FILIAL' ? branch : null,
  };
  await store(cnpj, data);
  return { status: 'found', data };
}
function unavailable(url: string, started: number, status: number): null {
  console.warn(
    JSON.stringify({
      event: 'cnpj.lookup_unavailable',
      provider: new URL(url).host,
      status,
      duration_ms: Math.round(performance.now() - started),
    }),
  );
  return null;
}
function fromRow(cnpj: string, row: LookupRow): CnpjLookup {
  if (!row.found || !row.legal_name) return { status: 'not_found' };
  return {
    status: 'found',
    data: {
      cnpj,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      registrationStatus: row.registration_status,
      cityId: row.city_id,
      branch: row.branch,
    },
  };
}
async function store(cnpj: string, data: CnpjData | null) {
  await pool().execute(
    `INSERT INTO cnpj_lookups(cnpj,found,legal_name,trade_name,registration_status,city_id,branch) VALUES(?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE found=VALUES(found),legal_name=VALUES(legal_name),trade_name=VALUES(trade_name),
    registration_status=VALUES(registration_status),city_id=VALUES(city_id),branch=VALUES(branch),fetched_at=UTC_TIMESTAMP(3)`,
    [
      cnpj,
      Boolean(data),
      data?.legalName ?? null,
      data?.tradeName ?? null,
      data?.registrationStatus ?? null,
      data?.cityId ?? null,
      data?.branch ?? null,
    ],
  );
}
// Um cadastro que nunca confirmou o e-mail em 24 horas não segura o CNPJ: quem digitou o e-mail
// errado, ou tentou ocupar o CNPJ de outra empresa, não bloqueia o estabelecimento.
const stale = `c.cnpj=? AND u.email_confirmed_at IS NULL AND u.created_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY)`;
export async function cnpjTaken(cnpj: string) {
  return Boolean(
    (
      await rows(
        pool(),
        `SELECT 1 FROM companies c JOIN users u ON u.id=c.account_id WHERE c.cnpj=? AND NOT (${stale})`,
        [cnpj, cnpj],
      )
    ).length,
  );
}
export async function saveNewCompany(db: Executor, accountId: string, company: NewCompany) {
  await db.execute(`DELETE c FROM companies c JOIN users u ON u.id=c.account_id WHERE ${stale}`, [
    company.cnpj,
  ]);
  // A plain INSERT: a conflicting CNPJ must fail, never overwrite another account's company.
  await db.execute('DELETE FROM companies WHERE account_id=?', [accountId]);
  const data = company.data;
  try {
    await db.execute(
      `INSERT INTO companies(account_id,cnpj,legal_name,trade_name,display_name,registration_status,city_id,branch,data_source,data_checked_at)
      VALUES(?,?,?,?,?,?,?,?,?,IF(?,UTC_TIMESTAMP(3),NULL))`,
      [
        accountId,
        company.cnpj,
        data?.legalName ?? company.legalName,
        data?.tradeName ?? null,
        company.displayName,
        data?.registrationStatus ?? null,
        data?.cityId ?? null,
        data?.branch ?? null,
        data ? 'RECEITA' : 'MANUAL',
        Boolean(data),
      ],
    );
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (code === 'ER_DUP_ENTRY') throw new Error('CNPJ_TAKEN');
    throw error;
  }
}
export async function companyFor(accountId: string) {
  const [company] = await rows<Company>(
    pool(),
    `SELECT c.* FROM companies c JOIN accounts a ON a.id=c.account_id WHERE c.account_id=? AND a.kind='company' AND a.blocked=FALSE`,
    [accountId],
  );
  return company || null;
}
export async function updateCompanyName(accountId: string, displayName: string) {
  await pool().execute(
    'UPDATE companies SET display_name=?,updated_at=UTC_TIMESTAMP(3) WHERE account_id=?',
    [displayName, accountId],
  );
}
export async function updateCompanyData(accountId: string, data: CnpjData) {
  await pool().execute(
    `UPDATE companies SET legal_name=?,trade_name=?,registration_status=?,city_id=?,branch=?,data_source='RECEITA',
    data_checked_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE account_id=? AND cnpj=?`,
    [
      data.legalName,
      data.tradeName,
      data.registrationStatus,
      data.cityId,
      data.branch,
      accountId,
      data.cnpj,
    ],
  );
}
