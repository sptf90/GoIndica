import { describe, expect, it } from 'vitest';

function ownOutcome(
  status: string,
  indicationId: string,
  selectedId: string | null,
  hiddenAt: string | null = null,
) {
  if (status === 'RESOLVED') {
    if (selectedId && selectedId === indicationId) return 'Sua indicação foi validada';
    return 'Pedido concluído';
  }
  if (status === 'CLOSED_TIMEOUT') return 'Encerrado por falta de avaliação';
  if (status === 'CLOSED_EXHAUSTED') return 'Encerrado — nenhuma indicação válida';
  if (status === 'CLOSED_NO_RESULT') return 'Encerrado sem solução';
  if (status === 'EVALUATING' && selectedId === indicationId) return 'Em avaliação';
  if (status === 'CANCELED' || hiddenAt) return null;
  return 'Enviada';
}

describe('DEC-10 / R-07 outcomes', () => {
  it('mostra só conclusão genérica para não escolhida', () => {
    expect(ownOutcome('RESOLVED', 'a', 'b')).toBe('Pedido concluído');
  });

  it('mostra validação para a escolhida válida', () => {
    expect(ownOutcome('RESOLVED', 'a', 'a')).toBe('Sua indicação foi validada');
  });

  it('marca em avaliação somente a selecionada', () => {
    expect(ownOutcome('EVALUATING', 'a', 'a')).toBe('Em avaliação');
    expect(ownOutcome('EVALUATING', 'b', 'a')).toBe('Enviada');
  });
});
