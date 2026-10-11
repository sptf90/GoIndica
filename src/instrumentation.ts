export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { environmentStatus } = await import('@/lib/env');
    console.info(JSON.stringify({ event: 'configuration', capabilities: environmentStatus() }));
  }
}
export async function onRequestError(error: unknown) {
  const { operationalError } = await import('@/lib/observability');
  operationalError('next.request', error);
}
