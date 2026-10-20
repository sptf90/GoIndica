// CNPJ numérico e alfanumérico (IN RFB 2.229/2024): 12 posições 0-9/A-Z e 2 dígitos verificadores.
const shape = /^[0-9A-Z]{12}[0-9]{2}$/;
export function normalizeCnpj(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
function digit(base: string) {
  let weight = 2,
    sum = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += (base.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}
export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!shape.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const first = digit(cnpj.slice(0, 12));
  return first === Number(cnpj[12]) && digit(cnpj.slice(0, 13)) === Number(cnpj[13]);
}
export function formatCnpj(value: string) {
  const c = normalizeCnpj(value).slice(0, 14);
  return [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12)].reduce(
    (out, part, i) => (part ? out + ['', '.', '.', '/', '-'][i] + part : out),
    '',
  );
}
const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para']);
const legalSuffix =
  /[\s,.-]+(LTDA\.?|EIRELI|ME|EPP|MEI|S\.?\/?A\.?|SOCIEDADE ANONIMA|SOCIEDADE LIMITADA)$/i;
// Sugestão de nome de apresentação: a Receita devolve tudo em maiúsculas e com a natureza jurídica.
export function presentationName(legalName: string, tradeName?: string | null) {
  let name = (tradeName?.trim() || legalName).trim().replace(/\s+/g, ' ');
  while (legalSuffix.test(name)) name = name.replace(legalSuffix, '');
  if (name !== name.toUpperCase()) return name.slice(0, 80);
  return name
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && connectors.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
    .slice(0, 80);
}
