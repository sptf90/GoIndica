import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { apiError } from '@/lib/http';
import { rows, transaction } from '@/lib/database/pool';

export async function GET(request: NextRequest) {
  try {
    const ctx = await apiMember();
    if (!ctx) return NextResponse.json({ error: 'Entre para continuar.' }, { status: 401 });
    const id = uuid.parse(request.nextUrl.searchParams.get('id'));
    const since = request.nextUrl.searchParams.get('since');

    const result = await transaction(async (db) => {
      const [req] = await rows<{
        id: string;
        requester_id: string;
        status: string;
        selected_indication_id: string | null;
        first_comparison_opened_at: string | null;
        evaluation_deadline_at: string | null;
        next_choice_deadline_at: string | null;
        hidden_at: string | null;
      }>(db, 'SELECT * FROM requests WHERE id=? FOR UPDATE', [id]);
      if (!req || req.hidden_at || req.requester_id !== ctx.user.id) throw new Error('NOT_ALLOWED');
      if (!req.first_comparison_opened_at && req.status === 'OPEN') {
        await db.execute(
          'UPDATE requests SET first_comparison_opened_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=? AND first_comparison_opened_at IS NULL',
          [id],
        );
      }

      const indications = await rows<{
        id: string;
        comment: string | null;
        place_id: string | null;
        created_at: string;
        manual_place_name: string | null;
        manual_place_address: string | null;
        links_json: unknown;
        user_id: string;
      }>(
        db,
        since
          ? `SELECT id,comment,place_id,created_at,manual_place_name,manual_place_address,links_json,user_id
             FROM indications WHERE request_id=? AND hidden_at IS NULL AND created_at>?
             ORDER BY created_at,id`
          : `SELECT id,comment,place_id,created_at,manual_place_name,manual_place_address,links_json,user_id
             FROM indications WHERE request_id=? AND hidden_at IS NULL
             ORDER BY created_at,id`,
        since ? [id, since] : [id],
      );

      if (indications.length) {
        await db.execute(
          `UPDATE indications SET presented_at=COALESCE(presented_at,UTC_TIMESTAMP(3))
           WHERE request_id=? AND hidden_at IS NULL AND id IN (${indications.map(() => '?').join(',')})`,
          [id, ...indications.map((i) => i.id)],
        );
      }

      const placeIds = [...new Set(indications.map((i) => i.place_id).filter(Boolean))] as string[];
      const places = placeIds.length
        ? await rows<{ id: string; name: string; address: string; google_place_id: string | null }>(
            db,
            `SELECT id,name,address,google_place_id FROM places WHERE id IN (${placeIds.map(() => '?').join(',')})`,
            placeIds,
          )
        : [];
      const placeMap = new Map(places.map((p) => [p.id, p]));
      const selected = req.selected_indication_id;

      const items = indications
        .filter((i) => {
          if (req.status === 'EVALUATING' && selected) return i.id === selected;
          if (req.status === 'RESOLVED' && selected) return i.id === selected;
          return true;
        })
        .map((i) => {
          const place = i.place_id ? placeMap.get(i.place_id) : null;
          const revealAuthor =
            selected === i.id && ['EVALUATING', 'RESOLVED'].includes(req.status);
          return {
            id: i.id,
            comment: i.comment,
            links: i.links_json,
            place: place
              ? {
                  name: place.name,
                  address: place.address,
                  mapsUrl: place.google_place_id
                    ? `https://www.google.com/maps/search/?api=1&query=place_id:${place.google_place_id}`
                    : null,
                }
              : i.manual_place_name
                ? {
                    name: i.manual_place_name,
                    address: i.manual_place_address,
                    mapsUrl: null,
                  }
                : null,
            // Nunca retornar username/foto; id interno só após seleção confirmada.
            authorId: revealAuthor ? i.user_id : null,
            created_at: i.created_at,
          };
        });

      return {
        status: req.status,
        evaluation_deadline_at: req.evaluation_deadline_at,
        next_choice_deadline_at: req.next_choice_deadline_at,
        selected_indication_id: selected,
        items,
      };
    });

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e, 'comparison.poll');
  }
}
