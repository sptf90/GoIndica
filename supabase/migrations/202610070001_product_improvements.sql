-- Additive product improvements; previously applied migrations remain immutable.
alter table public.reports add column reviewed_by uuid references public.profiles(id),
 add column reviewed_at timestamptz, add column decision_note text check(length(decision_note)<=500);

create table public.user_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email_reminders boolean not null default false, updated_at timestamptz not null default now()
);
create table public.followed_cities (
 user_id uuid not null references public.profiles(id) on delete cascade,
 city_id integer not null references public.cities(id), created_at timestamptz not null default now(), primary key(user_id,city_id)
);
create table public.request_interests (
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.requests(id), saved boolean not null default false,
 following boolean not null default false, created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 request_id uuid not null references public.requests(id),
 kind text not null check(kind in ('INDICATION_RECEIVED','RESULT_RECORDED','REWARD_RECEIVED','DECISION_REMINDER')),
 dedupe_key text not null unique, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_inbox on public.notifications(user_id,created_at desc,id);
create index notifications_unread on public.notifications(user_id) where read_at is null;
create index interests_followers on public.request_interests(request_id) where following;
create index interests_user on public.request_interests(user_id,created_at desc,request_id);
create table public.support_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('CLOSE_ACCOUNT','DATA_HELP')),
 reason text not null check(length(btrim(reason)) between 10 and 500),
 status text not null default 'OPEN' check(status in ('OPEN','PROCESSING','COMPLETED','DECLINED')),
 reviewer_id uuid references public.profiles(id), decision_note text check(length(decision_note)<=500),
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index support_pending on public.support_requests(user_id,kind) where status in ('OPEN','PROCESSING');
create table private.search_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 city_id integer not null references public.cities(id), request_id uuid references public.requests(id),
 kind text not null check(kind in ('MATCHED','NO_RESULT','CLICKED','USEFUL')), created_at timestamptz not null default now()
);
create unique index search_useful_once on private.search_events(user_id,request_id) where kind='USEFUL';
create index search_metrics on private.search_events(city_id,created_at,kind);
create table private.email_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 request_id uuid not null references public.requests(id), week text not null,
 status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','CANCELED')),
 attempts integer not null default 0, worker_id uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now(), sent_at timestamptz,
 unique(user_id,request_id,week)
);
create index email_pending on private.email_jobs(next_attempt_at) where status in ('PENDING','PROCESSING');
create index indications_first on public.indications(request_id,created_at);
create index rewards_user on public.reward_events(user_id,created_at desc);
create index audit_actor_event on public.audit_logs(actor_id,event_type,created_at);

alter table public.user_preferences enable row level security;
alter table public.followed_cities enable row level security;
alter table public.request_interests enable row level security;
alter table public.notifications enable row level security;
alter table public.support_requests enable row level security;
alter table private.search_events enable row level security;
alter table private.email_jobs enable row level security;
create policy preferences_read on public.user_preferences for select to authenticated using(user_id=auth.uid() and private.active(auth.uid()));
create policy cities_follow_read on public.followed_cities for select to authenticated using(user_id=auth.uid() and private.active(auth.uid()));
create policy interests_read on public.request_interests for select to authenticated using(user_id=auth.uid() and private.active(auth.uid()) and exists(select 1 from public.requests r where r.id=request_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and private.active(auth.uid()) and exists(select 1 from public.requests r where r.id=request_id));
create policy support_read on public.support_requests for select to authenticated using((user_id=auth.uid() and private.active(auth.uid())) or public.is_admin());
revoke all on public.user_preferences,public.followed_cities,public.request_interests,public.notifications,public.support_requests from anon,authenticated;
grant select on public.user_preferences,public.followed_cities,public.request_interests,public.notifications,public.support_requests to authenticated;

create function private.notify(p_user uuid,p_request uuid,p_kind text,p_key text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(user_id,request_id,kind,dedupe_key)
 select p_user,p_request,p_kind,p_key where private.active(p_user)
 on conflict(dedupe_key) do nothing
$$;
create function private.notify_indication() returns trigger language plpgsql security definer set search_path='' as $$
declare v_recipient uuid;
begin
 for v_recipient in
 select requester_id from public.requests where id=new.request_id
 union select user_id from public.request_interests where request_id=new.request_id and following and user_id<>new.user_id
 loop perform private.notify(v_recipient,new.request_id,'INDICATION_RECEIVED','indication:'||new.id||':'||v_recipient); end loop;
 return new;
end $$;
create trigger indication_notification after insert on public.indications for each row execute function private.notify_indication();
create function private.notify_resolution() returns trigger language plpgsql security definer set search_path='' as $$
declare v_recipient uuid;
begin
 for v_recipient in
 select user_id from public.indications where request_id=new.request_id and hidden_at is null
 union select user_id from public.request_interests where request_id=new.request_id and following and user_id<>new.resolved_by
 loop perform private.notify(v_recipient,new.request_id,'RESULT_RECORDED','result:'||new.id||':'||v_recipient); end loop;
 return new;
end $$;
create trigger resolution_notification after insert on public.request_resolutions for each row execute function private.notify_resolution();
create function private.notify_reward() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.notify(new.user_id,new.request_id,'REWARD_RECEIVED','reward:'||new.id); return new; end $$;
create trigger reward_notification after insert on public.reward_events for each row execute function private.notify_reward();

create function public.set_request_interest(p_request_id uuid,p_saved boolean default null,p_following boolean default null) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 if not exists(select 1 from public.requests where id=p_request_id and hidden_at is null) then raise exception 'NOT_ALLOWED'; end if;
 perform private.rate(v_actor,'interests',60,60);
 insert into public.request_interests(user_id,request_id,saved,following) values(v_actor,p_request_id,coalesce(p_saved,false),coalesce(p_following,false))
 on conflict(user_id,request_id) do update set saved=coalesce(p_saved,request_interests.saved),following=coalesce(p_following,request_interests.following);
end $$;
create function public.save_preferences(p_email_reminders boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 perform private.rate(v_actor,'preferences',20,3600);
 insert into public.user_preferences(user_id,email_reminders) values(v_actor,p_email_reminders)
 on conflict(user_id) do update set email_reminders=excluded.email_reminders,updated_at=now();
 if not p_email_reminders then update private.email_jobs set status='CANCELED',worker_id=null,lease_until=null where user_id=v_actor and status in ('PENDING','PROCESSING'); end if;
end $$;
create function public.set_followed_city(p_city_id integer,p_following boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 perform 1 from public.profiles where id=v_actor for update;
 perform private.rate(v_actor,'followed_cities',30,3600);
 if p_following then
  if not exists(select 1 from public.followed_cities where user_id=v_actor and city_id=p_city_id) and (select count(*) from public.followed_cities where user_id=v_actor)>=8 then raise exception 'CITY_LIMIT'; end if;
  insert into public.followed_cities(user_id,city_id) values(v_actor,p_city_id) on conflict do nothing;
 else delete from public.followed_cities where user_id=v_actor and city_id=p_city_id; end if;
end $$;
create function public.mark_notifications_read(p_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin update public.notifications set read_at=now() where user_id=v_actor and read_at is null and (p_id is null or id=p_id); end $$;
create function public.member_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin return jsonb_build_object(
 'unread',(select count(*) from public.notifications n join public.requests r on r.id=n.request_id where n.user_id=v_actor and n.read_at is null and r.hidden_at is null),
 'pending',(select count(*) from public.requests where requester_id=v_actor and hidden_at is null and (status='REVEALED' or (status='OPEN' and indication_count>0))),
 'saved',(select count(*) from public.request_interests i join public.requests r on r.id=i.request_id where i.user_id=v_actor and i.saved and r.hidden_at is null)); end $$;
create function public.refresh_reminders() returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request uuid;
begin
 for v_request in select id from public.requests where requester_id=v_actor and hidden_at is null
 and (status='REVEALED' or (status='OPEN' and indication_count>0)) and coalesce(responses_revealed_at,updated_at)<now()-interval '1 day'
 loop perform private.notify(v_actor,v_request,'DECISION_REMINDER','reminder:'||v_request||':'||to_char(now(),'IYYY-IW')); end loop;
end $$;

create or replace function public.profile_stats(p_username text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('points',coalesce((select sum(e.points) from public.reward_events e where e.user_id=p.id),0),
 'confirmations',(select count(*) from public.reward_events e where e.user_id=p.id),
 'requests',(select count(*) from public.requests r where r.requester_id=p.id and r.hidden_at is null),
 'indications',(select count(*) from public.indications i join public.requests r on r.id=i.request_id where i.user_id=p.id and i.hidden_at is null and r.hidden_at is null))
 from public.profiles p where p.username=p_username and private.active(p.id)
$$;

create function public.search_requests(p_city_id integer,p_query text default '',p_status public.request_status default 'OPEN',p_offset integer default 0) returns setof public.requests language sql stable set search_path='' as $$
 select r.* from public.requests r where r.city_id=p_city_id and r.status=p_status
 and (btrim(p_query)='' or to_tsvector('portuguese',r.description) @@ websearch_to_tsquery('portuguese',left(p_query,300)))
 order by case when btrim(p_query)='' then 0 else ts_rank(to_tsvector('portuguese',r.description),websearch_to_tsquery('portuguese',left(p_query,300))) end desc,
 r.created_at desc,r.id limit 21 offset greatest(0,least(p_offset,20000))
$$;
create function public.record_search_event(p_kind text,p_city_id integer,p_request_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 if p_kind not in ('MATCHED','NO_RESULT','CLICKED','USEFUL') then raise exception 'INVALID_INPUT'; end if;
 if p_kind in ('CLICKED','USEFUL') then
  if not exists(select 1 from public.requests r join public.request_resolutions s on s.request_id=r.id where r.id=p_request_id and r.city_id=p_city_id and r.hidden_at is null and r.status='RESOLVED') then raise exception 'NOT_ALLOWED'; end if;
 elsif p_request_id is not null or not exists(select 1 from public.cities where id=p_city_id) then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from private.search_events where user_id=v_actor and city_id=p_city_id and kind=p_kind and request_id is not distinct from p_request_id and (kind='USEFUL' or created_at>now()-interval '30 seconds')) then return; end if;
 perform private.rate(v_actor,'search_events',60,60);
 insert into private.search_events(user_id,city_id,request_id,kind) values(v_actor,p_city_id,p_request_id,p_kind) on conflict do nothing;
end $$;

drop function public.admin_metrics();
create function public.admin_metrics(p_city_id integer default null,p_since timestamptz default null,p_until timestamptz default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.actor(); if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
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

-- Existing callers keep their two-argument contract while UI can record a reason.
alter function public.admin_moderate(text,uuid) rename to admin_moderate_legacy;
revoke all on function public.admin_moderate_legacy(text,uuid) from authenticated;
create function public.admin_moderate(p_action text,p_target_id uuid,p_note text default 'Revisão administrativa registrada') returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 if length(btrim(p_note)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
 perform public.admin_moderate_legacy(p_action,p_target_id);
 if p_action='REVIEW_REPORT' then update public.reports set reviewed_by=v_actor,reviewed_at=now(),decision_note=btrim(p_note) where id=p_target_id; end if;
 perform private.log(v_actor,'MODERATION_DECISION','ADMIN_ACTION',p_target_id,jsonb_build_object('action',p_action,'note',btrim(p_note)));
end $$;

create or replace function public.consume_api_limit(p_bucket text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 if p_bucket not in ('places_search','places_details','places_view') then raise exception 'INVALID_INPUT'; end if;
 perform private.rate(v_actor,p_bucket,30,60);
 perform private.rate(v_actor,'places_daily',300,86400);
end $$;
create function public.request_support(p_kind text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_id uuid;
begin
 if p_kind='CLOSE_ACCOUNT' and public.is_admin() then raise exception 'ADMIN_ACCOUNT'; end if;
 perform private.rate(v_actor,'support',5,3600);
 insert into public.support_requests(user_id,kind,reason) values(v_actor,p_kind,btrim(p_reason)) returning id into v_id;
 perform private.log(v_actor,'SUPPORT_REQUESTED','SUPPORT',v_id,jsonb_build_object('kind',p_kind)); return v_id;
end $$;
create function public.admin_review_support(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_support public.support_requests;
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 select * into v_support from public.support_requests where id=p_id for update;
 if not found or v_support.status not in ('OPEN','PROCESSING') then raise exception 'NOT_ALLOWED'; end if;
 if p_decision not in ('COMPLETED','DECLINED') or length(btrim(p_note)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
 if v_support.kind='CLOSE_ACCOUNT' and p_decision='COMPLETED' then raise exception 'CLOSURE_REQUIRED'; end if;
 update public.support_requests set status=p_decision,reviewer_id=v_actor,decision_note=btrim(p_note),reviewed_at=now() where id=p_id;
 perform private.log(v_actor,'SUPPORT_REVIEWED','SUPPORT',p_id,jsonb_build_object('decision',p_decision));
end $$;
create function public.prepare_account_closure(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_support public.support_requests;
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 select * into v_support from public.support_requests where id=p_id for update;
 if not found or v_support.kind<>'CLOSE_ACCOUNT' or v_support.status not in ('OPEN','PROCESSING') or v_support.user_id=v_actor then raise exception 'NOT_ALLOWED'; end if;
 if exists(select 1 from private.accounts where id=v_support.user_id and is_admin) then raise exception 'ADMIN_ACCOUNT'; end if;
 update private.accounts set blocked=true where id=v_support.user_id;
 update public.support_requests set status='PROCESSING',reviewer_id=v_actor where id=p_id;
 return v_support.user_id;
end $$;

create or replace function private.guard_request_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.description,new.city_id,new.neighborhood) is distinct from (old.description,old.city_id,old.neighborhood) and
 (old.status<>'OPEN' or exists(select 1 from public.indications where request_id=old.id)) and
 not (public.is_admin() and coalesce(current_setting('app.anonymizing',true),'0')='1') then raise exception 'EDIT_LOCKED'; end if;
 if new.requester_id<>old.requester_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'NOT_ALLOWED'; end if;
 if new.status<>old.status and not ((old.status='OPEN' and new.status in ('REVEALED','CANCELED')) or (old.status='REVEALED' and new.status in ('RESOLVED','CLOSED_NO_RESULT','CANCELED'))) then raise exception 'INVALID_TRANSITION'; end if;
 return new;
end $$;
create or replace function private.guard_indication_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.request_id,new.user_id,new.place_id,new.created_at) is distinct from (old.id,old.request_id,old.user_id,old.place_id,old.created_at) then raise exception 'NOT_ALLOWED'; end if;
 if new.comment is distinct from old.comment and not (public.is_admin() and coalesce(current_setting('app.anonymizing',true),'0')='1') then raise exception 'NOT_ALLOWED'; end if;
 return new;
end $$;
create function public.complete_account_closure(p_id uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_support public.support_requests;
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 select * into v_support from public.support_requests where id=p_id for update;
 if not found or v_support.kind<>'CLOSE_ACCOUNT' or v_support.status<>'PROCESSING' or v_support.reviewer_id<>v_actor then raise exception 'NOT_ALLOWED'; end if;
 if length(btrim(p_note)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
 perform set_config('app.anonymizing','1',true);
 perform 1 from public.requests where requester_id=v_support.user_id order by id for update;
 update public.requests set description='Pedido de conta encerrada',neighborhood=null,status=case when status in ('OPEN','REVEALED') then 'CANCELED'::public.request_status else status end,canceled_at=case when status in ('OPEN','REVEALED') then now() else canceled_at end,updated_at=now() where requester_id=v_support.user_id;
 update public.indications set comment=null where user_id=v_support.user_id;
 update public.profiles set username='deleted_'||left(replace(gen_random_uuid()::text,'-',''),16),display_name='Conta encerrada',avatar_url=null,updated_at=now() where id=v_support.user_id;
 update public.reports set reason='Conteúdo anonimizado a pedido do titular' where reporter_id=v_support.user_id;
 delete from public.user_preferences where user_id=v_support.user_id;
 delete from public.followed_cities where user_id=v_support.user_id;
 delete from public.request_interests where user_id=v_support.user_id;
 delete from public.notifications where user_id=v_support.user_id;
 delete from private.search_events where user_id=v_support.user_id;
 update private.email_jobs set status='CANCELED',worker_id=null,lease_until=null where user_id=v_support.user_id and status in ('PENDING','PROCESSING');
 update public.support_requests set reason='Solicitação de conta encerrada',status=case when id=p_id then 'COMPLETED' else 'DECLINED' end,reviewer_id=v_actor,decision_note=case when id=p_id then btrim(p_note) else 'Conta encerrada por solicitação do titular' end,reviewed_at=now() where user_id=v_support.user_id;
 perform set_config('app.anonymizing','0',true);
 perform private.log(v_actor,'ACCOUNT_ANONYMIZED','SUPPORT',p_id);
end $$;

create function public.prepare_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 insert into public.notifications(user_id,request_id,kind,dedupe_key)
 select r.requester_id,r.id,'DECISION_REMINDER','reminder:'||r.id||':'||to_char(now(),'IYYY-IW') from public.requests r
 where r.hidden_at is null and private.active(r.requester_id) and (r.status='REVEALED' or (r.status='OPEN' and r.indication_count>0)) and coalesce(r.responses_revealed_at,r.updated_at)<now()-interval '1 day'
 on conflict do nothing;
 insert into private.email_jobs(user_id,request_id,week)
 select r.requester_id,r.id,to_char(now(),'IYYY-IW') from public.requests r join public.user_preferences p on p.user_id=r.requester_id and p.email_reminders
 where r.hidden_at is null and private.active(r.requester_id) and (r.status='REVEALED' or (r.status='OPEN' and r.indication_count>0)) and coalesce(r.responses_revealed_at,r.updated_at)<now()-interval '1 day'
 on conflict do nothing;
 get diagnostics v_count=row_count; return v_count;
end $$;
create function public.claim_email_jobs(p_worker uuid,p_limit integer default 20) returns table(id uuid,user_id uuid,request_id uuid) language plpgsql security definer set search_path='' as $$
begin
 update private.email_jobs j set status='CANCELED',worker_id=null,lease_until=null where j.status in ('PENDING','PROCESSING') and
 (j.attempts>=5 or not private.active(j.user_id) or not exists(select 1 from public.user_preferences p where p.user_id=j.user_id and p.email_reminders)
 or not exists(select 1 from public.requests r where r.id=j.request_id and r.hidden_at is null and (r.status='REVEALED' or (r.status='OPEN' and r.indication_count>0))));
 return query with jobs as (
 select j.id from private.email_jobs j where ((j.status='PENDING' and j.next_attempt_at<=now()) or (j.status='PROCESSING' and j.lease_until<now()))
 and j.attempts<5 order by j.created_at,j.id for update skip locked limit greatest(1,least(p_limit,20))
 ) update private.email_jobs j set status='PROCESSING',worker_id=p_worker,lease_until=now()+interval '15 minutes',attempts=j.attempts+1
 from jobs where j.id=jobs.id returning j.id,j.user_id,j.request_id;
end $$;
create function public.email_job_eligible(p_id uuid,p_worker uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.email_jobs j join public.user_preferences p on p.user_id=j.user_id
 join public.requests r on r.id=j.request_id where j.id=p_id and j.worker_id=p_worker and j.status='PROCESSING' and j.lease_until>now()
 and p.email_reminders and private.active(j.user_id) and r.hidden_at is null and (r.status='REVEALED' or (r.status='OPEN' and r.indication_count>0)))
$$;
create function public.finish_email_job(p_id uuid,p_worker uuid,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.email_jobs set status=case when p_sent then 'SENT' when attempts>=5 then 'CANCELED' else 'PENDING' end,
 sent_at=case when p_sent then now() else null end,worker_id=null,lease_until=null,next_attempt_at=now()+interval '10 minutes'
 where id=p_id and worker_id=p_worker and status='PROCESSING';
end $$;
create function public.health_check() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.cities) and to_regclass('public.notifications') is not null
$$;
create function public.admin_operations() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.actor(); if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 return jsonb_build_object('pending_email',(select count(*) from private.email_jobs where status in ('PENDING','PROCESSING')),
 'sent_email',(select count(*) from private.email_jobs where status='SENT'),
 'failed_email',(select count(*) from private.email_jobs where status='CANCELED' and attempts>=5));
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active(uuid) to anon,authenticated;
grant execute on function public.set_request_interest(uuid,boolean,boolean),public.save_preferences(boolean),public.set_followed_city(integer,boolean),
 public.mark_notifications_read(uuid),public.member_summary(),public.refresh_reminders(),public.search_requests(integer,text,public.request_status,integer),
 public.record_search_event(text,integer,uuid),public.admin_metrics(integer,timestamptz,timestamptz),public.admin_moderate(text,uuid,text),
 public.request_support(text,text),public.admin_review_support(uuid,text,text),public.prepare_account_closure(uuid),public.complete_account_closure(uuid,text),public.admin_operations() to authenticated;
grant execute on function public.prepare_reminders(),public.claim_email_jobs(uuid,integer),public.email_job_eligible(uuid,uuid),public.finish_email_job(uuid,uuid,boolean),public.health_check() to service_role;
