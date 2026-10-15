create table private.public_rate_limits (fingerprint text primary key check(fingerprint ~ '^[a-f0-9]{64}$'), window_start timestamptz not null, hits integer not null);
alter table private.public_rate_limits enable row level security;
drop function public.record_analytics(text);
create function public.record_analytics(p_event text,p_fingerprint text) returns void language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
 if p_event not in ('LANDING_VISIT','CTA_CLICK','SEARCH_REUSED') then raise exception 'INVALID_INPUT'; end if;
 insert into private.public_rate_limits(fingerprint,window_start,hits) values(p_fingerprint,clock_timestamp(),1)
 on conflict(fingerprint) do update set
 hits=case when private.public_rate_limits.window_start < clock_timestamp()-interval '1 minute' then 1 else private.public_rate_limits.hits+1 end,
 window_start=case when private.public_rate_limits.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else private.public_rate_limits.window_start end returning hits into v_hits;
 if v_hits>60 then raise exception 'RATE_LIMITED'; end if;
 delete from private.public_rate_limits where window_start<now()-interval '2 days';
 insert into private.analytics(event) values(p_event) on conflict(day,event) do update set hits=private.analytics.hits+1;
end $$;
revoke all on function public.record_analytics(text,text) from public,anon,authenticated;
grant execute on function public.record_analytics(text,text) to service_role;
