create or replace function public.admin_review_support(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_support public.support_requests;
begin
 if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
 select * into v_support from public.support_requests where id=p_id for update;
 if not found or v_support.status not in ('OPEN','PROCESSING') then raise exception 'NOT_ALLOWED'; end if;
 if p_decision not in ('COMPLETED','DECLINED') or length(btrim(p_note)) not between 10 and 500 then raise exception 'INVALID_INPUT'; end if;
 -- Once Auth closure has started it can only be completed, because the provider
 -- might already have irreversibly soft-deleted the identity.
 if v_support.kind='CLOSE_ACCOUNT' and (p_decision='COMPLETED' or v_support.status='PROCESSING') then raise exception 'CLOSURE_REQUIRED'; end if;
 update public.support_requests set status=p_decision,reviewer_id=v_actor,decision_note=btrim(p_note),reviewed_at=now() where id=p_id;
 perform private.log(v_actor,'SUPPORT_REVIEWED','SUPPORT',p_id,jsonb_build_object('decision',p_decision));
end $$;
