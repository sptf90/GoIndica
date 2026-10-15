create function public.export_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_result jsonb;
begin
 perform private.rate(v_actor,'data_export',3,3600);
 select jsonb_build_object('version',1,'exported_at',now(),
 'profile',(select to_jsonb(p) from public.profiles p where id=v_actor),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)) from public.requests r where requester_id=v_actor),'[]'),
 'indications',coalesce((select jsonb_agg(to_jsonb(i)) from public.indications i where user_id=v_actor),'[]'),
 'resolutions',coalesce((select jsonb_agg(to_jsonb(s)) from public.request_resolutions s where resolved_by=v_actor),'[]'),
 'rewards',coalesce((select jsonb_agg(to_jsonb(e)) from public.reward_events e where user_id=v_actor),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r where reporter_id=v_actor),'[]'),
 'preferences',(select to_jsonb(p) from public.user_preferences p where user_id=v_actor),
 'followed_cities',coalesce((select jsonb_agg(to_jsonb(c)) from public.followed_cities c where user_id=v_actor),'[]'),
 'interests',coalesce((select jsonb_agg(to_jsonb(i)) from public.request_interests i where user_id=v_actor),'[]'),
 'support',coalesce((select jsonb_agg(to_jsonb(s)) from public.support_requests s where user_id=v_actor),'[]')) into v_result;
 return v_result;
end $$;
grant execute on function public.export_account() to authenticated;
-- Avoid replaying an old delivery beyond the provider's 24h idempotency window.
-- Jobs can wait before their first claim; only retries have this deadline.
alter table private.email_jobs add column first_attempt_at timestamptz;
create or replace function public.claim_email_jobs(p_worker uuid,p_limit integer default 20) returns table(id uuid,user_id uuid,request_id uuid) language plpgsql security definer set search_path='' as $$
begin
 update private.email_jobs j set status='CANCELED',worker_id=null,lease_until=null where j.status in ('PENDING','PROCESSING') and
 ((j.attempts>=5 and (j.status='PENDING' or j.lease_until<now())) or j.first_attempt_at<now()-interval '23 hours' or not private.active(j.user_id) or not exists(select 1 from public.user_preferences p where p.user_id=j.user_id and p.email_reminders)
 or not exists(select 1 from public.requests r where r.id=j.request_id and r.hidden_at is null and (r.status='REVEALED' or (r.status='OPEN' and r.indication_count>0))));
 return query with jobs as (
 select j.id from private.email_jobs j where ((j.status='PENDING' and j.next_attempt_at<=now()) or (j.status='PROCESSING' and j.lease_until<now()))
 and j.attempts<5 order by j.created_at,j.id for update skip locked limit greatest(1,least(p_limit,20))
 ) update private.email_jobs j set status='PROCESSING',worker_id=p_worker,lease_until=now()+interval '15 minutes',attempts=j.attempts+1,first_attempt_at=coalesce(j.first_attempt_at,now())
 from jobs where j.id=jobs.id returning j.id,j.user_id,j.request_id;
end $$;
