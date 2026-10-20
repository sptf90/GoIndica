// Every link to someone else's profile carries the content it was opened from; the server
// authorizes that origin before showing the profile or its photo.
export type ProfileContext = { request?: string; rankingCity?: number };
function contextParams(context: ProfileContext) {
  const params = new URLSearchParams();
  if (context.request) params.set('pedido', context.request);
  if (context.rankingCity) params.set('ranking', String(context.rankingCity));
  return params;
}
export function profileUrl(username: string, context: ProfileContext = {}) {
  const params = contextParams(context).toString();
  return '/perfil/' + username + (params ? '?' + params : '');
}
export function profilePhotoUrl(
  profile: { id: string; photo_updated_at: string | null },
  context: ProfileContext = {},
) {
  if (!profile.photo_updated_at) return undefined;
  const params = contextParams(context);
  params.set('id', profile.id);
  params.set('v', String(Date.parse(profile.photo_updated_at)));
  return '/api/profile-photo?' + params.toString();
}
