-- Six additions to local discovery. Previously applied migrations are immutable.
alter table public.requests
 add column has_photo boolean not null default false,
 add column photo_updated_at timestamptz,
 add column wanting_count integer not null default 0 check(wanting_count>=0),
 add column reconfirmation_count integer not null default 0 check(reconfirmation_count>=0),
 add column last_reconfirmed_at timestamptz;
alter table public.request_interests add column wanted boolean not null default false;
create index requests_unanswered on public.requests(city_id,created_at,id)
 where status='OPEN' and indication_count=0 and hidden_at is null;

-- Small, processed JPEGs live outside the API tables. No public bucket or URL.
create table private.request_photos (
 request_id uuid primary key references public.requests(id) on delete cascade,
 jpeg bytea not null check(octet_length(jpeg) between 4 and 524288 and substring(jpeg from 1 for 3)=decode('ffd8ff','hex')),
 updated_at timestamptz not null default now()
);
alter table private.request_photos enable row level security;

create table public.request_reconfirmations (
 user_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.requests(id) on delete cascade,
 confirmed_at timestamptz not null default now(), primary key(user_id,request_id)
);
create index reconfirmations_request on public.request_reconfirmations(request_id,confirmed_at desc);
alter table public.request_reconfirmations enable row level security;
create policy reconfirmations_read on public.request_reconfirmations for select to authenticated
 using(user_id=auth.uid() and private.active(auth.uid()) and exists(select 1 from public.requests r where r.id=request_id));

create table public.topic_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 city_id integer not null references public.cities(id),
 term text not null check(length(btrim(term)) between 3 and 80),
 normalized_term text not null, created_at timestamptz not null default now(), unique(user_id,city_id,normalized_term)
);
create index topic_alerts_city on public.topic_alerts(city_id);
alter table public.topic_alerts enable row level security;
create policy topic_alerts_read on public.topic_alerts for select to authenticated using(user_id=auth.uid() and private.active(auth.uid()));
revoke all on public.request_reconfirmations,public.topic_alerts from anon,authenticated;
grant select on public.request_reconfirmations,public.topic_alerts to authenticated;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
 check(kind in ('INDICATION_RECEIVED','RESULT_RECORDED','REWARD_RECEIVED','DECISION_REMINDER','TOPIC_MATCH'));

create function private.sync_wanted_count() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.wanted then update public.requests set wanting_count=wanting_count+1 where id=new.request_id; end if;
 elsif tg_op='DELETE' then
  if old.wanted then update public.requests set wanting_count=wanting_count-1 where id=old.request_id; end if;
 elsif new.wanted is distinct from old.wanted then
  update public.requests set wanting_count=wanting_count+case when new.wanted then 1 else -1 end where id=new.request_id;
 end if;
 return null;
end $$;
create trigger wanted_count after insert or update or delete on public.request_interests for each row execute function private.sync_wanted_count();

create function public.set_request_wanted(p_request_id uuid,p_wanted boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests;
begin
 if p_wanted is null then raise exception 'INVALID_INPUT'; end if;
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.hidden_at is not null or v_request.requester_id=v_actor then raise exception 'NOT_ALLOWED'; end if;
 if p_wanted and v_request.status not in ('OPEN','REVEALED') then raise exception 'REQUEST_CLOSED'; end if;
 perform private.rate(v_actor,'wanted',60,60);
 insert into public.request_interests(user_id,request_id,wanted,following) values(v_actor,p_request_id,p_wanted,p_wanted)
 on conflict(user_id,request_id) do update set wanted=p_wanted,following=case when p_wanted then true else request_interests.following end;
end $$;

create function private.sync_reconfirmations() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(new.request_id,old.request_id);
begin
 -- The caller holds the request lock, including when removing account data.
 update public.requests set reconfirmation_count=(select count(*) from public.request_reconfirmations where request_id=v_id),
 last_reconfirmed_at=(select max(confirmed_at) from public.request_reconfirmations where request_id=v_id) where id=v_id;
 return null;
end $$;
create trigger reconfirmation_counts after insert or delete on public.request_reconfirmations for each row execute function private.sync_reconfirmations();
create function public.reconfirm_discovery(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_request public.requests;
begin
 select * into v_request from public.requests where id=p_request_id for update;
 if not found or v_request.hidden_at is not null or v_request.requester_id=v_actor or v_request.status<>'RESOLVED'
 or not exists(select 1 from public.request_resolutions where request_id=p_request_id and type='INDICATED_PLACE' and place_id is not null)
 then raise exception 'NOT_ALLOWED'; end if;
 if exists(select 1 from public.request_reconfirmations where user_id=v_actor and request_id=p_request_id) then return; end if;
 perform private.rate(v_actor,'reconfirmations',20,3600);
 insert into public.request_reconfirmations(user_id,request_id) values(v_actor,p_request_id) on conflict do nothing;
end $$;

create function public.add_topic_alert(p_city_id integer,p_term text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_term text:=btrim(p_term); v_normalized text:=public.search_text(v_term);
begin
 perform 1 from public.profiles where id=v_actor for update;
 if v_term is null or length(v_term) not between 3 and 80 or numnode(plainto_tsquery('portuguese',v_normalized))=0 then raise exception 'INVALID_INPUT'; end if;
 perform private.rate(v_actor,'topic_alerts',30,3600);
 if not exists(select 1 from public.topic_alerts where user_id=v_actor and city_id=p_city_id and normalized_term=v_normalized)
 and (select count(*) from public.topic_alerts where user_id=v_actor)>=12 then raise exception 'TOPIC_LIMIT'; end if;
 insert into public.topic_alerts(user_id,city_id,term,normalized_term) values(v_actor,p_city_id,v_term,v_normalized) on conflict do nothing;
end $$;
create function public.remove_topic_alert(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin
 perform private.rate(v_actor,'topic_alerts',30,3600);
 delete from public.topic_alerts where id=p_id and user_id=v_actor;
end $$;
create function private.notify_topics() returns trigger language plpgsql security definer set search_path='' as $$
declare v_recipient uuid;
begin
 if new.status<>'OPEN' or new.hidden_at is not null then return new; end if;
 for v_recipient in select distinct a.user_id from public.topic_alerts a
 where a.city_id=new.city_id and a.user_id<>new.requester_id and private.active(a.user_id)
 and to_tsvector('portuguese',public.search_text(new.description)) @@ plainto_tsquery('portuguese',a.normalized_term)
 loop perform private.notify(v_recipient,new.id,'TOPIC_MATCH','topic:'||new.id||':'||v_recipient); end loop;
 return new;
end $$;
create trigger topic_notifications after insert or update of description,city_id on public.requests for each row execute function private.notify_topics();

create function public.search_unanswered_requests(p_city_id integer,p_query text default '',p_offset integer default 0) returns setof public.requests language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.read_actor(); v_query tsquery:=websearch_to_tsquery('portuguese',public.search_text(left(p_query,300)));
begin
 return query select r.* from public.requests r where r.city_id=p_city_id and r.status='OPEN' and r.indication_count=0 and r.hidden_at is null
 and (btrim(p_query)='' or to_tsvector('portuguese',public.search_text(r.description)) @@ v_query)
 order by r.created_at asc,r.id limit 21 offset greatest(0,least(p_offset,20000));
end $$;

create function private.save_request_photo(p_request_id uuid,p_photo text) returns void language plpgsql security definer set search_path='' as $$
declare v_photo bytea;
begin
 if length(p_photo)>710000 then raise exception 'PHOTO_TOO_LARGE'; end if;
 begin v_photo:=decode(p_photo,'base64'); exception when others then raise exception 'INVALID_PHOTO'; end;
 if octet_length(v_photo) not between 4 and 524288 or substring(v_photo from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'INVALID_PHOTO'; end if;
 insert into private.request_photos(request_id,jpeg) values(p_request_id,v_photo)
 on conflict(request_id) do update set jpeg=excluded.jpeg,updated_at=now();
 update public.requests set has_photo=true,photo_updated_at=now() where id=p_request_id;
end $$;
create function public.create_request_with_photo(p_description text,p_city_id integer,p_neighborhood text default null,p_photo text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 v_id:=public.create_request(p_description,p_city_id,p_neighborhood);
 if p_photo is not null then perform private.save_request_photo(v_id,p_photo); end if;
 return v_id;
end $$;
create function public.edit_request_with_photo(p_request_id uuid,p_description text,p_city_id integer,p_neighborhood text default null,p_photo text default null,p_remove_photo boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.edit_request(p_request_id,p_description,p_city_id,p_neighborhood);
 if p_photo is not null then perform private.save_request_photo(p_request_id,p_photo);
 elsif p_remove_photo then
  delete from private.request_photos where request_id=p_request_id;
  update public.requests set has_photo=false,photo_updated_at=null where id=p_request_id;
 end if;
end $$;
create function public.request_photo(p_request_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=private.read_actor();
begin
 if not exists(select 1 from public.requests where id=p_request_id and (hidden_at is null or public.is_admin())) then raise exception 'NOT_ALLOWED'; end if;
 return (select encode(jpeg,'base64') from private.request_photos where request_id=p_request_id);
end $$;

create function public.consume_share_card_limit() returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor();
begin perform private.rate(v_actor,'share_cards',10,60); end $$;

-- Extend data export and account closure without copying earlier implementations.
alter function public.export_account() rename to export_account_before_discovery;
revoke all on function public.export_account_before_discovery() from authenticated;
create function public.export_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_result jsonb:=public.export_account_before_discovery();
begin
 return v_result || jsonb_build_object('version',2,
 'topic_alerts',coalesce((select jsonb_agg(to_jsonb(a)) from public.topic_alerts a where user_id=v_actor),'[]'),
 'reconfirmations',coalesce((select jsonb_agg(to_jsonb(c)) from public.request_reconfirmations c where user_id=v_actor),'[]'),
 'photos',coalesce((select jsonb_agg(jsonb_build_object('request_id',p.request_id,'jpeg_base64',encode(p.jpeg,'base64'),'updated_at',p.updated_at)) from private.request_photos p join public.requests r on r.id=p.request_id where r.requester_id=v_actor),'[]'));
end $$;
alter function public.complete_account_closure(uuid,text) rename to complete_account_closure_before_discovery;
revoke all on function public.complete_account_closure_before_discovery(uuid,text) from authenticated;
create function public.complete_account_closure(p_id uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_user uuid;
begin
 select user_id into v_user from public.support_requests where id=p_id;
 perform public.complete_account_closure_before_discovery(p_id,p_note);
 perform 1 from public.requests where id in (select request_id from public.request_reconfirmations where user_id=v_user) order by id for update;
 delete from public.topic_alerts where user_id=v_user;
 delete from public.request_reconfirmations where user_id=v_user;
 delete from private.request_photos where request_id in (select id from public.requests where requester_id=v_user);
 update public.requests set has_photo=false,photo_updated_at=null where requester_id=v_user;
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active(uuid) to anon,authenticated;
grant execute on function public.set_request_wanted(uuid,boolean),public.reconfirm_discovery(uuid),
 public.add_topic_alert(integer,text),public.remove_topic_alert(uuid),public.search_unanswered_requests(integer,text,integer),
 public.create_request_with_photo(text,integer,text,text),public.edit_request_with_photo(uuid,text,integer,text,text,boolean),
 public.request_photo(uuid),public.consume_share_card_limit(),public.export_account(),public.complete_account_closure(uuid,text) to authenticated;
