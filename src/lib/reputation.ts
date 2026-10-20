// Provisório até a especificação de reputação: só o selo é exibido, nunca a contagem.
export function reputationLabel(confirmations: number) {
  if (confirmations >= 50) return 'Referência da comunidade';
  if (confirmations >= 10) return 'Ajuda frequente';
  if (confirmations >= 1) return 'Primeira indicação confirmada';
  return 'Sem selo ainda';
}
