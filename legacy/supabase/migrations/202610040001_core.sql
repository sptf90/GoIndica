-- Atomic product rules. All mutations are RPC-only; table writes are revoked.
create schema if not exists private;
revoke all on schema private from public;
create type public.request_status as enum ('OPEN','REVEALED','RESOLVED','CLOSED_NO_RESULT','CANCELED');
create type public.resolution_type as enum ('INDICATED_PLACE','OTHER_PLACE','NOT_FOUND');
create table public.cities (
 id integer primary key, name text not null, normalized_name text not null,
 state_name text not null, state_code text not null check(length(state_code)=2),
 country_name text not null default 'Brasil', country_code text not null default 'BR' check(country_code='BR'),
 slug text not null unique, unique(normalized_name,state_code,country_code)
);
create table private.accounts (
 id uuid primary key references auth.users(id) on delete cascade,
 blocked boolean not null default false, is_admin boolean not null default false, created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references private.accounts(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 display_name text not null check(length(btrim(display_name)) between 2 and 60),
 avatar_url text check(avatar_url is null or avatar_url ~ '^https://lh[0-9]+\.googleusercontent\.com/'),
 home_city_id integer not null references public.cities(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.requests (
 id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id),
 description text not null check(length(btrim(description)) between 3 and 300),
 city_id integer not null references public.cities(id), neighborhood text check(length(neighborhood)<=100),
 status public.request_status not null default 'OPEN', indication_count integer not null default 0 check(indication_count>=0),
 responses_revealed_at timestamptz, canceled_at timestamptz, hidden_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status in ('REVEALED','RESOLVED','CLOSED_NO_RESULT') and responses_revealed_at is not null) or status in ('OPEN','CANCELED')),
 check(status <> 'OPEN' or responses_revealed_at is null),
 check((status='CANCELED') = (canceled_at is not null))
);
-- Only the exempt Google identifier is stored. Google names/addresses are fetched live.
create table public.places (
 id uuid primary key default gen_random_uuid(), google_place_id text not null unique check(length(google_place_id) between 5 and 255),
 city_id integer not null references public.cities(id), last_verified_at timestamptz not null default now()
);
create table public.indications (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests(id),
 user_id uuid not null references public.profiles(id), place_id uuid not null references public.places(id),
 comment text check(length(comment)<=300), created_at timestamptz not null default now(), hidden_at timestamptz,
 unique(request_id,user_id), unique(id,request_id,user_id,place_id)
);
create table public.request_resolutions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.requests(id),
 type public.resolution_type not null, place_id uuid references public.places(id),
 resolved_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 check((type='INDICATED_PLACE' and place_id is not null) or (type <> 'INDICATED_PLACE' and place_id is null))
);
create table public.reward_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 request_id uuid not null references public.requests(id), indication_id uuid not null references public.indications(id),
 city_id integer not null references public.cities(id), type text not null default 'SUCCESSFUL_INDICATION_REWARD' check(type='SUCCESSFUL_INDICATION_REWARD'),
 points integer not null default 10 check(points=10), created_at timestamptz not null default now(),
 unique(indication_id,type), unique(user_id,request_id,type)
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id),
 target_type text not null check(target_type in ('REQUEST','INDICATION')), target_id uuid not null,
 reason text not null check(length(btrim(reason)) between 10 and 500), status text not null default 'OPEN' check(status in ('OPEN','REVIEWED')),
 created_at timestamptz not null default now(), unique(reporter_id,target_type,target_id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references private.accounts(id),
 event_type text not null, entity_type text not null, entity_id uuid,
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table private.rate_limits (actor_id uuid not null references private.accounts(id) on delete cascade, bucket text not null,
 window_start timestamptz not null, hits integer not null, primary key(actor_id,bucket));
create table private.analytics (day date not null default current_date, event text not null check(event in ('LANDING_VISIT','CTA_CLICK','SEARCH_REUSED')), hits bigint not null default 1, primary key(day,event));
create index requests_feed on public.requests(city_id,status,created_at desc) where hidden_at is null;
create index requests_author on public.requests(requester_id,created_at desc);
create index indications_user on public.indications(user_id,created_at desc);
create index indications_place on public.indications(request_id,place_id) where hidden_at is null;
create index rewards_city on public.reward_events(city_id,user_id,created_at);
create index audit_created on public.audit_logs(created_at desc);
create index reports_open on public.reports(status,created_at desc);
create index requests_search on public.requests using gin(to_tsvector('portuguese',description));

create function private.provision_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.accounts(id) values(new.id);
 insert into public.audit_logs(actor_id,event_type,entity_type,entity_id) values(new.id,'SIGNUP','ACCOUNT',new.id);
 return new;
end $$;
create trigger provision_account after insert on auth.users for each row execute function private.provision_account();
insert into private.accounts(id) select id from auth.users on conflict do nothing;

create function private.active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.accounts where id=p_id and not blocked)
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.accounts where id=auth.uid() and is_admin and not blocked)
$$;
create function private.actor(p_onboarded boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid := auth.uid(); v_blocked boolean;
begin
 if v_id is null then raise exception 'AUTH_REQUIRED'; end if;
 select blocked into v_blocked from private.accounts where id=v_id for share;
 if not found or v_blocked then raise exception 'ACCOUNT_BLOCKED'; end if;
 if p_onboarded and not exists(select 1 from public.profiles where id=v_id) then raise exception 'ONBOARDING_REQUIRED'; end if;
 return v_id;
end $$;
create function private.rate(p_actor uuid,p_bucket text,p_max integer,p_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
 insert into private.rate_limits(actor_id,bucket,window_start,hits) values(p_actor,p_bucket,clock_timestamp(),1)
 on conflict(actor_id,bucket) do update set
 hits=case when private.rate_limits.window_start <= clock_timestamp()-make_interval(secs=>p_seconds) then 1 else private.rate_limits.hits+1 end,
 window_start=case when private.rate_limits.window_start <= clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else private.rate_limits.window_start end
 returning hits into v_hits;
 if v_hits>p_max then raise exception 'RATE_LIMITED'; end if;
end $$;
create function private.log(p_actor uuid,p_event text,p_entity text,p_id uuid,p_metadata jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_id,event_type,entity_type,entity_id,metadata) values(p_actor,p_event,p_entity,p_id,p_metadata)
$$;
create function public.account_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.actor(false);
begin return jsonb_build_object('admin',public.is_admin(),'onboarded',exists(select 1 from public.profiles where id=v_actor)); end $$;
create function public.save_profile(p_username text,p_display_name text,p_city_id integer,p_use_google_photo boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.actor(false); v_avatar text; v_first boolean;
begin
 perform private.rate(v_actor,'profile',20,3600);
 select raw_user_meta_data->>'avatar_url' into v_avatar from auth.users where id=v_actor;
 if not p_use_google_photo or v_avatar is null or v_avatar !~ '^https://lh[0-9]+\.googleusercontent\.com/' then v_avatar:=null; end if;
 v_first := not exists(select 1 from public.profiles where id=v_actor);
 insert into public.profiles(id,username,display_name,home_city_id,avatar_url) values(v_actor,lower(btrim(p_username)),btrim(p_display_name),p_city_id,v_avatar)
 on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,home_city_id=excluded.home_city_id,avatar_url=excluded.avatar_url,updated_at=now();
 perform private.log(v_actor,case when v_first then 'ONBOARDING_COMPLETED' else 'PROFILE_UPDATED' end,'PROFILE',v_actor);
end $$;
create function public.log_login() returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.actor(false);
begin perform private.rate(v_actor,'login_log',30,3600); perform private.log(v_actor,'LOGIN','ACCOUNT',v_actor); end $$;
create function public.consume_api_limit(p_bucket text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := private.actor();
begin
 if p_bucket='places_search' then perform private.rate(v_actor,p_bucket,30,60); perform private.rate(v_actor,'places_daily',300,86400);
 elsif p_bucket='places_details' then perform private.rate(v_actor,p_bucket,30,60); perform private.rate(v_actor,'places_daily',300,86400);
 else raise exception 'INVALID_INPUT'; end if;
end $$;
create function public.create_request(p_description text,p_city_id integer,p_neighborhood text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_id uuid;
begin
 perform private.rate(v_actor,'requests',10,3600);
 insert into public.requests(requester_id,description,city_id,neighborhood) values(v_actor,btrim(p_description),p_city_id,nullif(btrim(p_neighborhood),'')) returning id into v_id;
 perform private.log(v_actor,'REQUEST_CREATED','REQUEST',v_id);
 return v_id;
end $$;
create function public.edit_request(p_request_id uuid,p_description text,p_city_id integer,p_neighborhood text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests;
begin
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.requester_id<>v_actor or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 if v_request.status<>'OPEN' or exists(select 1 from public.indications where request_id=p_request_id) then raise exception 'EDIT_LOCKED'; end if;
 update public.requests set description=btrim(p_description),city_id=p_city_id,neighborhood=nullif(btrim(p_neighborhood),''),updated_at=now() where id=p_request_id;
 perform private.log(v_actor,'REQUEST_EDITED','REQUEST',p_request_id);
end $$;
-- Only service_role can invoke this attestation boundary, after official Places validation.
create function public.submit_verified_indication(p_actor uuid,p_request_id uuid,p_google_place_id text,p_verified_city_id integer,p_comment text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_request public.requests; v_place uuid; v_id uuid; v_existing_city integer;
begin
 if not private.active(p_actor) or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'NOT_ALLOWED'; end if;
 perform 1 from private.accounts where id=p_actor and not blocked for share;
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 if v_request.requester_id=p_actor then raise exception 'SELF_INDICATION'; end if;
 if v_request.status<>'OPEN' then raise exception 'RESPONSES_LOCKED'; end if;
 if v_request.city_id<>p_verified_city_id then raise exception 'INVALID_CITY'; end if;
 if exists(select 1 from public.indications where request_id=p_request_id and user_id=p_actor) then raise exception 'ALREADY_INDICATED'; end if;
 perform private.rate(p_actor,'indications',30,3600);
 insert into public.places(google_place_id,city_id) values(p_google_place_id,p_verified_city_id)
 on conflict(google_place_id) do update set last_verified_at=now() returning id,city_id into v_place,v_existing_city;
 if v_existing_city<>p_verified_city_id then raise exception 'INVALID_CITY'; end if;
 insert into public.indications(request_id,user_id,place_id,comment) values(p_request_id,p_actor,v_place,nullif(btrim(p_comment),'')) returning id into v_id;
 update public.requests set indication_count=indication_count+1,updated_at=now() where id=p_request_id;
 perform private.log(p_actor,'INDICATION_CREATED','INDICATION',v_id);
 perform private.log(p_actor,'INDICATION_AUDIT_SIGNALS','INDICATION',v_id,
  jsonb_build_object('indications_last_hour',(select count(*) from public.indications where user_id=p_actor and created_at>now()-interval '1 hour'),
    'recent_account',exists(select 1 from private.accounts where id=p_actor and created_at>now()-interval '7 days')));
 if v_request.indication_count=0 then perform private.log(p_actor,'FIRST_INDICATION','REQUEST',p_request_id,jsonb_build_object('seconds',extract(epoch from now()-v_request.created_at))); end if;
 return v_id;
end $$;
create function public.reveal_responses(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests;
begin
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.requester_id<>v_actor or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 if v_request.status='REVEALED' then return; end if;
 if v_request.status<>'OPEN' then raise exception 'REQUEST_CLOSED'; end if;
 if v_request.indication_count=0 then raise exception 'NO_INDICATIONS'; end if;
 update public.requests set status='REVEALED',responses_revealed_at=clock_timestamp(),updated_at=now() where id=p_request_id;
 perform private.log(v_actor,'RESPONSES_REVEALED','REQUEST',p_request_id);
end $$;
create function public.resolve_request(p_request_id uuid,p_type public.resolution_type,p_place_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests; v_resolution public.request_resolutions; v_id uuid; v_reward record;
begin
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.requester_id<>v_actor or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 select * into v_resolution from public.request_resolutions where request_id=p_request_id;
 if found then
   if v_resolution.type=p_type and v_resolution.place_id is not distinct from p_place_id then return v_resolution.id; end if;
   raise exception 'REQUEST_CLOSED';
 end if;
 if v_request.status<>'REVEALED' then raise exception 'REVEAL_REQUIRED'; end if;
 if p_type='INDICATED_PLACE' then
   if p_place_id is null or not exists(select 1 from public.indications where request_id=p_request_id and place_id=p_place_id and hidden_at is null) then raise exception 'INVALID_PLACE'; end if;
 elsif p_place_id is not null then raise exception 'INVALID_PLACE'; end if;
 insert into public.request_resolutions(request_id,type,place_id,resolved_by) values(p_request_id,p_type,p_place_id,v_actor) returning id into v_id;
 update public.requests set status=case when p_type='NOT_FOUND' then 'CLOSED_NO_RESULT'::public.request_status else 'RESOLVED'::public.request_status end,updated_at=now() where id=p_request_id;
 if p_type='INDICATED_PLACE' then
   for v_reward in
     insert into public.reward_events(user_id,request_id,indication_id,city_id)
     select i.user_id,i.request_id,i.id,v_request.city_id from public.indications i
     where i.request_id=p_request_id and i.place_id=p_place_id and i.hidden_at is null and private.active(i.user_id)
     on conflict do nothing returning *
   loop
     perform private.log(v_reward.user_id,'SUCCESSFUL_INDICATION_REWARD','REWARD',v_reward.id,
       jsonb_build_object('request_id',p_request_id,'points',10));
   end loop;
 end if;
 perform private.log(v_actor,'REQUEST_RESOLVED','REQUEST',p_request_id,
  jsonb_build_object('type',p_type,'seconds',extract(epoch from now()-v_request.created_at)));
 -- Audit signals only; no automatic punishment.
 perform private.log(v_actor,'RESOLUTION_AUDIT_SIGNALS','REQUEST',p_request_id,
  jsonb_build_object('fast_resolution',now()-v_request.created_at<interval '5 minutes',
    'requester_resolutions_last_day',(select count(*) from public.request_resolutions where resolved_by=v_actor and created_at>now()-interval '1 day'),
    'recent_indicants',(select count(*) from public.reward_events e join private.accounts a on a.id=e.user_id where e.request_id=p_request_id and a.created_at>now()-interval '7 days'),
    'recent_account',exists(select 1 from private.accounts where id=v_actor and created_at>now()-interval '7 days'),
    'repeated_pairs', (select count(*) from public.reward_events e join public.requests r on r.id=e.request_id
      where r.requester_id=v_actor and e.user_id in(select user_id from public.reward_events where request_id=p_request_id))));
 return v_id;
end $$;
create function public.cancel_request(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests;
begin
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.requester_id<>v_actor or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 if v_request.status='CANCELED' then return; end if;
 if v_request.status<>'OPEN' then raise exception 'REQUEST_CLOSED'; end if;
 update public.requests set status='CANCELED',canceled_at=now(),updated_at=now() where id=p_request_id;
 perform private.log(v_actor,'REQUEST_CANCELED','REQUEST',p_request_id);
end $$;
create function public.report_content(p_target_type text,p_target_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 perform private.rate(v_actor,'reports',10,3600);
 if p_target_type='REQUEST' then
   if not exists(select 1 from public.requests where id=p_target_id and hidden_at is null) then raise exception 'NOT_ALLOWED'; end if;
 elsif p_target_type='INDICATION' then
   if not exists(select 1 from public.indications i join public.requests r on r.id=i.request_id
     where i.id=p_target_id and i.hidden_at is null and r.hidden_at is null and
       (i.user_id=v_actor or (r.requester_id=v_actor and r.status<>'OPEN'))) then raise exception 'NOT_ALLOWED'; end if;
 else raise exception 'INVALID_INPUT'; end if;
 insert into public.reports(reporter_id,target_type,target_id,reason) values(v_actor,p_target_type,p_target_id,btrim(p_reason)) on conflict(reporter_id,target_type,target_id) do nothing;
 perform private.log(v_actor,'CONTENT_REPORTED',p_target_type,p_target_id);
end $$;
create function public.admin_moderate(p_action text,p_target_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request uuid;
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 if p_action in ('BLOCK_USER','UNBLOCK_USER') then
   if p_target_id=v_actor then raise exception 'NOT_ALLOWED'; end if;
   update private.accounts set blocked=(p_action='BLOCK_USER') where id=p_target_id;
   if not found then raise exception 'NOT_ALLOWED'; end if;
 elsif p_action='HIDE_REQUEST' then
   perform 1 from public.requests where id=p_target_id for update;
   update public.requests set hidden_at=now(),status=case when status in ('OPEN','REVEALED') then 'CANCELED'::public.request_status else status end,
    canceled_at=case when status in ('OPEN','REVEALED') then now() else canceled_at end,updated_at=now() where id=p_target_id;
   if not found then raise exception 'NOT_ALLOWED'; end if;
 elsif p_action='HIDE_INDICATION' then
   select request_id into v_request from public.indications where id=p_target_id;
   perform 1 from public.requests where id=v_request for update;
   update public.indications set hidden_at=now() where id=p_target_id and hidden_at is null;
   if found then update public.requests set indication_count=indication_count-1 where id=v_request; end if;
 elsif p_action='REVIEW_REPORT' then
   update public.reports set status='REVIEWED' where id=p_target_id;
   if not found then raise exception 'NOT_ALLOWED'; end if;
 else raise exception 'INVALID_INPUT'; end if;
 perform private.log(v_actor,p_action,'ADMIN_ACTION',p_target_id);
end $$;
create function public.admin_accounts(p_search text default '',p_offset integer default 0) returns table(id uuid,username text,display_name text,blocked boolean,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 perform private.actor(); if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 return query select a.id,p.username,p.display_name,a.blocked,a.created_at from private.accounts a left join public.profiles p on p.id=a.id
 where p.username ilike '%'||left(p_search,60)||'%' or p.display_name ilike '%'||left(p_search,60)||'%' or (p_search='' and p.id is null)
 order by a.created_at desc limit 30 offset greatest(0,least(p_offset,100000));
end $$;
create function public.city_ranking(p_city_id integer,p_offset integer default 0) returns table("position" bigint,username text,display_name text,avatar_url text,points bigint,confirmations bigint) language sql stable security definer set search_path='' as $$
 select row_number() over(order by sum(e.points) desc,count(*) desc,min(e.created_at),p.id),p.username,p.display_name,p.avatar_url,sum(e.points),count(*)
 from public.reward_events e join public.profiles p on p.id=e.user_id where e.city_id=p_city_id and private.active(p.id)
 group by p.id order by sum(e.points) desc,count(*) desc,min(e.created_at),p.id limit 30 offset greatest(0,least(p_offset,100000))
$$;
create function public.profile_stats(p_username text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('points',coalesce(sum(e.points),0),'confirmations',count(e.id))
 from public.profiles p left join public.reward_events e on e.user_id=p.id where p.username=p_username and private.active(p.id)
$$;
create function public.admin_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 return jsonb_build_object('requests',(select count(*) from public.requests),
 'with_indications',(select count(*) from public.requests where indication_count>0),
 'resolved',(select count(*) from public.request_resolutions where type<>'NOT_FOUND'),
 'contributors',(select count(distinct user_id) from public.indications),
 'avg_first_indication_seconds',(select avg((metadata->>'seconds')::numeric) from public.audit_logs where event_type='FIRST_INDICATION'),
 'avg_resolution_seconds',(select avg((metadata->>'seconds')::numeric) from public.audit_logs where event_type='REQUEST_RESOLVED'),
 'analytics',(select coalesce(jsonb_object_agg(event,hits),'{}') from(select event,sum(hits) hits from private.analytics group by event) a));
end $$;
create function public.record_analytics(p_event text) returns void language sql security definer set search_path='' as $$
 insert into private.analytics(event) values(p_event) on conflict(day,event) do update set hits=private.analytics.hits+1
$$;

-- Database backstops even for future privileged application code.
create function private.guard_indication() returns trigger language plpgsql set search_path='' as $$
declare v_request public.requests; v_city integer;
begin
 select * into v_request from public.requests where id=new.request_id for update;
 if v_request.status<>'OPEN' or v_request.hidden_at is not null then raise exception 'RESPONSES_LOCKED'; end if;
 if new.user_id=v_request.requester_id then raise exception 'SELF_INDICATION'; end if;
 select city_id into v_city from public.places where id=new.place_id;
 if v_city<>v_request.city_id then raise exception 'INVALID_CITY'; end if;
 if not private.active(new.user_id) then raise exception 'ACCOUNT_BLOCKED'; end if;
 return new;
end $$;
create trigger guard_indication before insert on public.indications for each row execute function private.guard_indication();
create function private.guard_resolution() returns trigger language plpgsql set search_path='' as $$
declare v_request public.requests;
begin
 select * into v_request from public.requests where id=new.request_id for update;
 if v_request.status<>'REVEALED' or new.resolved_by<>v_request.requester_id or v_request.hidden_at is not null then raise exception 'NOT_ALLOWED'; end if;
 if new.type='INDICATED_PLACE' and not exists(select 1 from public.indications where request_id=new.request_id and place_id=new.place_id and hidden_at is null) then raise exception 'INVALID_PLACE'; end if;
 return new;
end $$;
create trigger guard_resolution before insert on public.request_resolutions for each row execute function private.guard_resolution();
create function private.guard_reward() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.indications i join public.requests r on r.id=i.request_id
 join public.request_resolutions s on s.request_id=r.id where i.id=new.indication_id and i.user_id=new.user_id and i.request_id=new.request_id
 and r.city_id=new.city_id and s.type='INDICATED_PLACE' and s.place_id=i.place_id and i.hidden_at is null) then raise exception 'INVALID_REWARD'; end if;
 return new;
end $$;
create trigger guard_reward before insert on public.reward_events for each row execute function private.guard_reward();
create function private.immutable_ledger() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_LEDGER'; end $$;
create trigger immutable_rewards before update or delete on public.reward_events for each row execute function private.immutable_ledger();
create trigger immutable_resolutions before update or delete on public.request_resolutions for each row execute function private.immutable_ledger();
create trigger immutable_audit before update or delete on public.audit_logs for each row execute function private.immutable_ledger();

alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
alter table public.places enable row level security;
alter table public.indications enable row level security;
alter table public.request_resolutions enable row level security;
alter table public.reward_events enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table private.accounts enable row level security;
alter table private.rate_limits enable row level security;
alter table private.analytics enable row level security;
create policy cities_read on public.cities for select to anon,authenticated using(true);
create policy profiles_read on public.profiles for select to anon,authenticated using(private.active(id) or id=auth.uid() or public.is_admin());
create policy requests_read on public.requests for select to authenticated using((private.active(auth.uid()) and hidden_at is null) or public.is_admin());
create policy indications_read on public.indications for select to authenticated using(public.is_admin() or
 (private.active(auth.uid()) and hidden_at is null and exists(select 1 from public.requests r where r.id=request_id and r.hidden_at is null
 and (user_id=auth.uid() or (r.requester_id=auth.uid() and r.status<>'OPEN')))));
create policy resolutions_read on public.request_resolutions for select to authenticated using(exists(select 1 from public.requests r where r.id=request_id));
create policy places_read on public.places for select to authenticated using(public.is_admin() or
 exists(select 1 from public.indications i where i.place_id=places.id) or exists(select 1 from public.request_resolutions s where s.place_id=places.id));
create policy rewards_read on public.reward_events for select to authenticated using((user_id=auth.uid() and private.active(auth.uid())) or public.is_admin());
create policy reports_read on public.reports for select to authenticated using((reporter_id=auth.uid() and private.active(auth.uid())) or public.is_admin());
create policy audit_read on public.audit_logs for select to authenticated using(public.is_admin());

revoke all on all tables in schema public from anon,authenticated;
grant select on public.cities,public.profiles to anon,authenticated;
grant select on public.requests,public.places,public.indications,public.request_resolutions,public.reward_events,public.reports,public.audit_logs to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema public to anon,authenticated,service_role;
-- Helpers needed only by RLS; no table access in private is granted.
grant usage on schema private to anon,authenticated;
grant execute on function private.active(uuid) to anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.city_ranking(integer,integer),public.profile_stats(text) to anon,authenticated;
grant execute on function public.account_state(),public.save_profile(text,text,integer,boolean),public.log_login(),public.consume_api_limit(text),
 public.create_request(text,integer,text),public.edit_request(uuid,text,integer,text),public.reveal_responses(uuid),public.resolve_request(uuid,public.resolution_type,uuid),
 public.cancel_request(uuid),public.report_content(text,uuid,text),public.admin_moderate(text,uuid),public.admin_accounts(text,integer),public.admin_metrics() to authenticated;
grant execute on function public.submit_verified_indication(uuid,uuid,text,integer,text),public.record_analytics(text) to service_role;
-- Future functions must explicitly receive grants.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- Per-schema defaults cannot revoke the global PUBLIC execute default.
alter default privileges revoke execute on functions from public;
