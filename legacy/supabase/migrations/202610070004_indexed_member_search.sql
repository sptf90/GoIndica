-- Full text operators cannot be pushed through a generic RLS security barrier.
-- This RPC authorizes the actor once, then applies the exact visibility rule
-- explicitly. Table RLS remains enabled for all direct reads and writes.
create or replace function public.search_requests(p_city_id integer,p_query text default '',p_status public.request_status default 'OPEN',p_offset integer default 0) returns setof public.requests language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_admin boolean:=public.is_admin(); v_query tsquery;
begin
 v_query:=websearch_to_tsquery('portuguese',public.search_text(left(p_query,300)));
 if btrim(p_query)='' then
  return query select r.* from public.requests r where r.city_id=p_city_id and r.status=p_status and (r.hidden_at is null or v_admin)
  order by r.created_at desc,r.id limit 21 offset greatest(0,least(p_offset,20000));
 else
  return query select r.* from public.requests r where r.city_id=p_city_id and r.status=p_status and (r.hidden_at is null or v_admin)
  and to_tsvector('portuguese',public.search_text(r.description)) @@ v_query
  order by ts_rank(to_tsvector('portuguese',public.search_text(r.description)),v_query) desc,r.created_at desc,r.id limit 21 offset greatest(0,least(p_offset,20000));
 end if;
end $$;
