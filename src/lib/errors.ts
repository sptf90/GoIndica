import { z } from 'zod';
import type { ActionState } from './types';
const messages: Record<string, string> = {
  INVALID_PHOTO: 'Escolha uma foto JPG, PNG ou WebP válida, sem animação.',
  PHOTO_TOO_LARGE: 'A foto é muito grande. Escolha uma imagem de até 5 MB.',
  PHOTO_DIMENSIONS: 'A resolução desta foto é muito alta. Reduza a imagem e tente novamente.',
  TOPIC_LIMIT: 'Você pode ter até 12 alertas. Remova um para adicionar outro.',
  CURRENT_PASSWORD_INVALID: 'A senha atual está incorreta.',
  BODY_TOO_LARGE: 'A requisição excedeu o tamanho permitido.',
  SERVICE_UNAVAILABLE: 'O serviço está temporariamente indisponível. Tente novamente em instantes.',
  CITY_LIMIT: 'Você pode acompanhar até 8 cidades. Remova uma para adicionar outra.',
  ADMIN_ACCOUNT:
    'Transfira a administração e remova seu papel de administrador antes de encerrar a conta.',
  CLOSURE_REQUIRED: 'Use a ação de encerrar e anonimizar para concluir esta solicitação.',
  AUTH_REQUIRED: 'Entre com sua conta para continuar.',
  ACCOUNT_BLOCKED: 'Esta conta está bloqueada. Entre em contato com a administração.',
  ONBOARDING_REQUIRED: 'Complete seu perfil para continuar.',
  NOT_ALLOWED: 'Você não tem permissão para realizar esta ação.',
  SELF_INDICATION: 'Você não pode indicar na sua própria solicitação.',
  ALREADY_INDICATED: 'Você já fez uma indicação para esta solicitação.',
  INVALID_CITY:
    'Este estabelecimento fica em outra cidade. Escolha um local dentro da cidade do pedido.',
  RESPONSES_LOCKED:
    'As indicações desta solicitação já foram abertas ou o pedido foi encerrado. Novas respostas não são mais aceitas.',
  REQUEST_CLOSED: 'Esta solicitação já foi encerrada.',
  REVEAL_REQUIRED: 'Abra as indicações antes de confirmar o resultado.',
  NO_INDICATIONS: 'Ainda ninguém indicou um local.',
  INVALID_PLACE: 'Selecione um estabelecimento indicado neste pedido.',
  EDIT_LOCKED:
    'O pedido só pode ser editado enquanto estiver aberto e não tiver recebido nenhuma indicação.',
  RATE_LIMITED: 'Você fez muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  PLACES_UNAVAILABLE:
    'Não foi possível validar este estabelecimento agora. Tente novamente em instantes.',
  CONFIGURATION_REQUIRED:
    'O serviço ainda precisa ser configurado. Consulte as instruções de instalação.',
  INVALID_INPUT: 'Revise os campos e tente novamente.',
};
export function safeError(error: unknown): ActionState {
  if (error instanceof z.ZodError)
    return {
      error: error.issues[0]?.message || messages.INVALID_INPUT,
      fields: z.flattenError(error).fieldErrors as Record<string, string[]>,
    };
  const candidate =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const key = Object.keys(messages).find((k) => candidate.includes(k));
  if (key) return { error: messages[key] };
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
    return { error: 'Este nome de usuário já está em uso ou esta contribuição já foi registrada.' };
  return { error: 'Não foi possível concluir agora. Tente novamente em instantes.' };
}
export function check<T extends { data: unknown; error: unknown }>(
  result: T,
): NonNullable<T['data']> {
  if (result.error) throw result.error;
  return result.data as NonNullable<T['data']>;
}
