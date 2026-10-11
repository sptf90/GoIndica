-- Fixed Portuguese normalization is immutable, so the same expression can be
-- indexed and used by PostgREST RPC without depending on an extension schema.
create function public.search_text(p_text text) returns text language sql immutable strict set search_path='' as $$
 select translate(lower(p_text),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')
$$;
drop index public.requests_search;
create index requests_search on public.requests using gin(to_tsvector('portuguese',public.search_text(description)));
create or replace function public.search_requests(p_city_id integer,p_query text default '',p_status public.request_status default 'OPEN',p_offset integer default 0) returns setof public.requests language sql stable set search_path='' as $$
 select r.* from public.requests r where r.city_id=p_city_id and r.status=p_status
 and (btrim(p_query)='' or to_tsvector('portuguese',public.search_text(r.description)) @@ websearch_to_tsquery('portuguese',public.search_text(left(p_query,300))))
 order by case when btrim(p_query)='' then 0 else ts_rank(to_tsvector('portuguese',public.search_text(r.description)),websearch_to_tsquery('portuguese',public.search_text(left(p_query,300)))) end desc,
 r.created_at desc,r.id limit 21 offset greatest(0,least(p_offset,20000))
$$;
grant execute on function public.search_text(text) to authenticated;
