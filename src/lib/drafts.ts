import { z } from 'zod';
const draftSchema = z.object({
  version: z.literal(1),
  description: z.string().max(300),
  neighborhood: z.string().max(100),
  savedAt: z.number(),
  city: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    normalized_name: z.string(),
    state_name: z.string(),
    state_code: z.string().length(2),
    country_name: z.string(),
    country_code: z.literal('BR'),
    slug: z.string(),
  }),
});
export type RequestDraft = z.infer<typeof draftSchema>;
export function parseDraft(raw: string | null, now = Date.now()): RequestDraft | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const draft = draftSchema.parse(JSON.parse(raw));
    return draft.savedAt <= now && now - draft.savedAt < 7 * 86400000 ? draft : null;
  } catch {
    return null;
  }
}
