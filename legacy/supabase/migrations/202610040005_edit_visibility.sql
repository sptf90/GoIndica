-- A removed indication still locks editing. Expose only the owner's edit affordance.
create function public.request_editable(p_request_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.requests r where r.id=p_request_id and r.requester_id=auth.uid()
 and private.active(auth.uid()) and r.status='OPEN' and r.hidden_at is null
 and not exists(select 1 from public.indications i where i.request_id=r.id))
$$;
revoke all on function public.request_editable(uuid) from public,anon,authenticated;
grant execute on function public.request_editable(uuid) to authenticated;
