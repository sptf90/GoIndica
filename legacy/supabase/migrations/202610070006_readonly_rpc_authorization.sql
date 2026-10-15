-- PostgREST runs STABLE RPCs in read-only transactions. Read authorization
-- does not lock accounts; write RPCs continue to use private.actor() FOR SHARE.
create function private.read_actor(p_onboarded boolean default true) returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=auth.uid(); v_blocked boolean;
begin
 if v_id is null then raise exception 'AUTH_REQUIRED'; end if;
 select blocked into v_blocked from private.accounts where id=v_id;
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 if v_blocked then raise exception 'ACCOUNT_BLOCKED'; end if;
 if p_onboarded and not exists(select 1 from public.profiles where id=v_id) then raise exception 'ONBOARDING_REQUIRED'; end if;
 return v_id;
end $$;
revoke all on function private.read_actor(boolean) from public,anon,authenticated;

create or replace function public.member_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.read_actor();
begin return jsonb_build_object(
 'unread',(select count(*) from public.notifications n join public.requests r on r.id=n.request_id where n.user_id=v_actor and n.read_at is null and r.hidden_at is null),
 'pending',(select count(*) from public.requests where requester_id=v_actor and hidden_at is null and (status='REVEALED' or (status='OPEN' and indication_count>0))),
 'saved',(select count(*) from public.request_interests i join public.requests r on r.id=i.request_id where i.user_id=v_actor and i.saved and r.hidden_at is null)); end $$;

create or replace function public.admin_metrics(p_city_id integer default null,p_since timestamptz default null,p_until timestamptz default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.read_actor(); if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 if p_since is not null and p_until is not null and p_since>=p_until then raise exception 'INVALID_INPUT'; end if;
 with eligible as (
  select r.*,s.type as resolution_type,s.created_at as resolved_at,
   (select min(i.created_at) from public.indications i where i.request_id=r.id) as first_at
  from public.requests r left join public.request_resolutions s on s.request_id=r.id
  where r.hidden_at is null and r.status<>'CANCELED' and (p_city_id is null or r.city_id=p_city_id)
  and (p_since is null or r.created_at>=p_since) and (p_until is null or r.created_at<p_until)
 ), times as (
  select extract(epoch from first_at-created_at) as first_seconds,
  case when resolution_type='INDICATED_PLACE' then extract(epoch from resolved_at-created_at) end as resolution_seconds from eligible
 ) select jsonb_build_object(
  'requests',(select count(*) from eligible),'with_indications',(select count(*) from eligible where first_at is not null),
  'resolved',(select count(*) from eligible where resolution_type='INDICATED_PLACE'),
  'other_place',(select count(*) from eligible where resolution_type='OTHER_PLACE'),
  'not_found',(select count(*) from eligible where resolution_type='NOT_FOUND'),
  'without_indications',(select count(*) from eligible where status='OPEN' and first_at is null),
  'awaiting_decision',(select count(*) from eligible where status='REVEALED' or (status='OPEN' and indication_count>0)),
  'contributors',(select count(distinct i.user_id) from public.indications i join eligible e on e.id=i.request_id),
  'returning_contributors',(select count(*) from (select i.user_id from public.indications i join eligible e on e.id=i.request_id group by i.user_id having count(*)>1) c),
  'onboarded',(select count(distinct l.actor_id) from public.audit_logs l join public.profiles p on p.id=l.actor_id where l.event_type='ONBOARDING_COMPLETED' and (p_city_id is null or p.home_city_id=p_city_id) and (p_since is null or l.created_at>=p_since) and (p_until is null or l.created_at<p_until)),
  'avg_first_indication_seconds',(select avg(first_seconds) from times),
  'median_first_indication_seconds',(select percentile_cont(0.5) within group(order by first_seconds) from times),
  'p90_first_indication_seconds',(select percentile_cont(0.9) within group(order by first_seconds) from times),
  'avg_resolution_seconds',(select avg(resolution_seconds) from times),
  'median_resolution_seconds',(select percentile_cont(0.5) within group(order by resolution_seconds) from times),
  'p90_resolution_seconds',(select percentile_cont(0.9) within group(order by resolution_seconds) from times),
  'analytics',(select coalesce(jsonb_object_agg(event,hits),'{}') from(select event,sum(hits) hits from private.analytics where (p_since is null or day>=(p_since at time zone 'UTC')::date) and (p_until is null or day<(p_until at time zone 'UTC')::date) group by event) a),
  'search',(select coalesce(jsonb_object_agg(kind,hits),'{}') from(select kind,count(*) hits from private.search_events where (p_city_id is null or city_id=p_city_id) and (p_since is null or created_at>=p_since) and (p_until is null or created_at<p_until) group by kind) a)
 ) into v_result;
 return v_result;
end $$;

create or replace function public.admin_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.read_actor(); if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 return jsonb_build_object('pending_email',(select count(*) from private.email_jobs where status in ('PENDING','PROCESSING')),
 'sent_email',(select count(*) from private.email_jobs where status='SENT'),
 'failed_email',(select count(*) from private.email_jobs where status='CANCELED' and attempts>=5));
end $$;

create or replace function public.search_requests(p_city_id integer,p_query text default '',p_status public.request_status default 'OPEN',p_offset integer default 0) returns setof public.requests language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.read_actor(); v_admin boolean:=public.is_admin(); v_query tsquery;
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
