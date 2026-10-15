-- Export own records, including delivery/search history, without worker leases or credentials.
create or replace function public.export_account() returns jsonb language plpgsql security definer set search_path='' as $$
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
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.notifications n where user_id=v_actor),'[]'),
 'search_events',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'city_id',e.city_id,'request_id',e.request_id,'created_at',e.created_at)) from private.search_events e where user_id=v_actor),'[]'),
 'email_deliveries',coalesce((select jsonb_agg(jsonb_build_object('request_id',j.request_id,'week',j.week,'status',j.status,'created_at',j.created_at,'sent_at',j.sent_at)) from private.email_jobs j where user_id=v_actor),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(l)) from public.audit_logs l where actor_id=v_actor),'[]'),
 'places',coalesce((select jsonb_agg(to_jsonb(p)) from public.places p where p.id in (select place_id from public.indications where user_id=v_actor union select place_id from public.request_resolutions where resolved_by=v_actor)),'[]'),
 'support',coalesce((select jsonb_agg(to_jsonb(s)) from public.support_requests s where user_id=v_actor),'[]')) into v_result;
 return v_result;
end $$;
