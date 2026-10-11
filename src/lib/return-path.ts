const memberPath =
  /^\/(?:app|atividades|ranking|perfil(?:\/[a-z][a-z0-9_]{2,23})?|notificacoes|salvos|conta|preferencias|pedidos\/(?:novo|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\/(?:editar|indicar))?))$/;

export function returnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) <= 32)
  )
    return '/app';
  try {
    const url = new URL(value, 'https://internal.invalid');
    if (
      url.origin !== 'https://internal.invalid' ||
      !memberPath.test(url.pathname) ||
      url.pathname !== value.split(/[?#]/)[0]
    )
      return '/app';
    return url.pathname + url.search;
  } catch {
    return '/app';
  }
}

export function accessLink(path: '/entrar' | '/cadastro' | '/onboarding', destination: unknown) {
  const next = returnPath(destination);
  return path + (next === '/app' ? '' : '?next=' + encodeURIComponent(next));
}

export function callbackDestination(value: unknown, origin: string) {
  if (typeof value === 'string' && value.startsWith(origin + '/auth/callback?')) {
    try {
      return returnPath(new URL(value).searchParams.get('next'));
    } catch {
      return '/app';
    }
  }
  return returnPath(value);
}
