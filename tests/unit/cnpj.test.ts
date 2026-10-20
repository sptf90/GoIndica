import { expect, test } from 'vitest';
import { formatCnpj, isValidCnpj, normalizeCnpj, presentationName } from '@/lib/cnpj';
import { companySignupSchema } from '@/lib/validation/schemas';

test('valida CNPJ numérico e alfanumérico pelos dígitos verificadores', () => {
  expect(isValidCnpj('19.131.243/0001-97')).toBe(true);
  expect(isValidCnpj('00000000000272')).toBe(true);
  expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
  expect(isValidCnpj('12abc34501de35')).toBe(true);
  expect(isValidCnpj('19131243000198')).toBe(false);
  expect(isValidCnpj('12ABC34501DE36')).toBe(false);
  expect(isValidCnpj('11111111111111')).toBe(false);
  expect(isValidCnpj('1913124300019')).toBe(false);
  expect(isValidCnpj('12ABC34501DEA5')).toBe(false);
});
test('normaliza e formata o CNPJ enquanto é digitado', () => {
  expect(normalizeCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
  expect(formatCnpj('19131243000197')).toBe('19.131.243/0001-97');
  expect(formatCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  expect(formatCnpj('191312')).toBe('19.131.2');
  expect(formatCnpj('19.131.243/0001-97999')).toBe('19.131.243/0001-97');
});
test('sugere nome de apresentação legível a partir dos dados da Receita', () => {
  expect(presentationName('OPEN KNOWLEDGE BRASIL', 'REDE PELO CONHECIMENTO LIVRE')).toBe(
    'Rede Pelo Conhecimento Livre',
  );
  expect(presentationName('PADARIA PAO DOURADO DE RIO PRETO LTDA', '')).toBe(
    'Padaria Pao Dourado de Rio Preto',
  );
  expect(presentationName('COMERCIO DE ALIMENTOS SILVA E FILHOS EIRELI - ME', null)).toBe(
    'Comercio de Alimentos Silva e Filhos',
  );
  expect(presentationName('Mercado Bom Preço Ltda')).toBe('Mercado Bom Preço');
  expect(presentationName('A'.repeat(200)).length).toBeLessThanOrEqual(80);
});
test('cadastro empresarial exige CNPJ válido, nome e declaração de representação', () => {
  const base = {
    email: 'Empresa@Teste.invalid',
    password: 'senha-forte-123',
    passwordConfirmation: 'senha-forte-123',
    cnpj: '19.131.243/0001-97',
    displayName: ' Rede Livre ',
    declaration: 'on',
  };
  expect(companySignupSchema.parse(base)).toMatchObject({
    email: 'empresa@teste.invalid',
    cnpj: '19131243000197',
    displayName: 'Rede Livre',
  });
  expect(companySignupSchema.safeParse({ ...base, cnpj: '19131243000198' }).success).toBe(false);
  expect(companySignupSchema.safeParse({ ...base, declaration: undefined }).success).toBe(false);
  expect(companySignupSchema.safeParse({ ...base, displayName: 'A' }).success).toBe(false);
  expect(
    companySignupSchema.safeParse({ ...base, passwordConfirmation: 'outra-senha-123' }).success,
  ).toBe(false);
});
