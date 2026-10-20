'use client';
import { useEffect, useRef, useState } from 'react';
import { ActionForm } from './action-form';
import { EmailField, PasswordFields } from './auth-fields';
import { formatCnpj, isValidCnpj, normalizeCnpj } from '@/lib/cnpj';
import {
  lookupCompany,
  signupCompany,
  type CompanyLookupResult,
  type CompanySummary,
} from '@/server/company-actions';

type Status = CompanyLookupResult['status'] | 'idle' | 'checking';
const messages: Partial<Record<Status, string>> = {
  checking: 'Consultando a Receita Federal…',
  invalid: 'Confira o CNPJ: os dígitos verificadores não conferem.',
  taken:
    'Este CNPJ já possui cadastro no GoIndica. Se o estabelecimento é seu, entre com a conta já criada.',
  not_found: 'Este CNPJ não foi encontrado na Receita Federal. Confira os números.',
  inactive:
    'A Receita Federal indica que este CNPJ não está ativo. Só estabelecimentos ativos podem se cadastrar.',
  unavailable:
    'Não conseguimos consultar a Receita Federal agora. A razão social precisa vir da Receita para seguir.',
  limited: 'Muitas consultas seguidas. Aguarde alguns minutos e tente novamente.',
};
export function CompanySignupForm({ disabled }: { disabled: boolean }) {
  const [cnpj, setCnpj] = useState('');
  const [result, setResult] = useState<{ cnpj: string; value: CompanyLookupResult } | null>(null);
  const [name, setName] = useState('');
  const [attempt, setAttempt] = useState(0);
  const edited = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const normalized = normalizeCnpj(cnpj);
  const complete = normalized.length === 14;
  const local: Status | null = !complete ? 'idle' : isValidCnpj(normalized) ? null : 'invalid';
  const status: Status = local ?? (result?.cnpj === normalized ? result.value.status : 'checking');
  const company: CompanySummary | null =
    result?.cnpj === normalized && 'company' in result.value ? result.value.company : null;
  const ready = status === 'found';
  useEffect(() => {
    if (local) return;
    let active = true;
    const timer = setTimeout(async () => {
      const value = await lookupCompany(normalized).catch((): CompanyLookupResult => ({
        status: 'unavailable',
      }));
      if (!active) return;
      setResult({ cnpj: normalized, value });
      if ('company' in value && !edited.current) setName(value.company.suggestedName);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalized, local, attempt]);
  useEffect(() => {
    input.current?.setCustomValidity(
      ready || status === 'checking' ? '' : messages[status] || 'Informe o CNPJ.',
    );
  }, [ready, status]);
  const blocking = ['invalid', 'taken', 'not_found', 'inactive', 'limited', 'unavailable'].includes(
    status,
  );
  return (
    <ActionForm
      action={signupCompany}
      label="Criar conta da empresa"
      pendingLabel="Criando conta…"
      disabled={disabled || !ready}
      className="company-signup"
    >
      <div className="field">
        <label htmlFor="cnpj">CNPJ do estabelecimento</label>
        <input
          ref={input}
          id="cnpj"
          name="cnpj"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="00.000.000/0000-00"
          maxLength={18}
          required
          value={cnpj}
          onChange={(event) => setCnpj(formatCnpj(event.target.value))}
          aria-invalid={blocking ? true : undefined}
          aria-describedby="cnpj-hint cnpj-status"
        />
        <span className="hint" id="cnpj-hint">
          Cada unidade tem seu próprio cadastro. Aceita o CNPJ numérico e o novo alfanumérico.
        </span>
        <span
          className={blocking ? 'hint field-error' : 'hint'}
          id="cnpj-status"
          aria-live="polite"
        >
          {status === 'found' ? '' : messages[status] || ''}
        </span>
        {status === 'unavailable' ? (
          <button
            type="button"
            className="button secondary company-retry"
            onClick={() => {
              setResult(null);
              setAttempt((value) => value + 1);
            }}
          >
            Consultar novamente
          </button>
        ) : null}
      </div>
      {company ? (
        <section
          className={status === 'inactive' ? 'company-card inactive' : 'company-card'}
          aria-label="Dados encontrados na Receita Federal"
        >
          <p className="company-card-source">
            {status === 'found' ? 'Encontrado na Receita Federal' : 'Situação irregular na Receita'}
          </p>
          <strong>{company.legalName}</strong>
          <dl>
            {company.tradeName ? (
              <div>
                <dt>Nome fantasia</dt>
                <dd>{company.tradeName}</dd>
              </div>
            ) : null}
            <div>
              <dt>Situação</dt>
              <dd>{company.registrationStatus || 'Não informada'}</dd>
            </div>
            {company.city ? (
              <div>
                <dt>Sede</dt>
                <dd>{company.city}</dd>
              </div>
            ) : null}
            {company.branch ? (
              <div>
                <dt>Unidade</dt>
                <dd>{company.branch === 'MATRIZ' ? 'Matriz' : 'Filial'}</dd>
              </div>
            ) : null}
          </dl>
          {status === 'found' ? (
            <p className="hint">Não é este estabelecimento? Confira o CNPJ digitado.</p>
          ) : null}
        </section>
      ) : null}
      {ready ? (
        <>
          <div className="field">
            <label htmlFor="displayName">Nome de apresentação</label>
            <input
              id="displayName"
              name="displayName"
              minLength={2}
              maxLength={80}
              required
              value={name}
              onChange={(event) => {
                edited.current = true;
                setName(event.target.value);
              }}
              aria-describedby="displayName-hint"
            />
            <span className="hint" id="displayName-hint">
              Como a empresa prefere ser chamada. Você pode mudar quando quiser no painel.
            </span>
          </div>
          <fieldset className="company-access">
            <legend>Acesso ao painel</legend>
            <EmailField />
            <PasswordFields creating />
          </fieldset>
          <label className="checkbox">
            <input type="checkbox" name="declaration" required />
            <span>Declaro que represento este estabelecimento e posso cadastrá-lo.</span>
          </label>
        </>
      ) : null}
    </ActionForm>
  );
}
