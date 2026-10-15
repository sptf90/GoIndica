create function private.guard_request_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.description,new.city_id,new.neighborhood) is distinct from (old.description,old.city_id,old.neighborhood) and
 (old.status<>'OPEN' or exists(select 1 from public.indications where request_id=old.id)) then raise exception 'EDIT_LOCKED'; end if;
 if new.requester_id<>old.requester_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'NOT_ALLOWED'; end if;
 if new.status<>old.status and not ((old.status='OPEN' and new.status in ('REVEALED','CANCELED')) or (old.status='REVEALED' and new.status in ('RESOLVED','CLOSED_NO_RESULT','CANCELED'))) then raise exception 'INVALID_TRANSITION'; end if;
 return new;
end $$;
create trigger guard_request_update before update on public.requests for each row execute function private.guard_request_update();
create function private.guard_indication_update() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.request_id,new.user_id,new.place_id,new.comment,new.created_at) is distinct from (old.id,old.request_id,old.user_id,old.place_id,old.comment,old.created_at) then raise exception 'NOT_ALLOWED'; end if;
 return new;
end $$;
create trigger guard_indication_update before update on public.indications for each row execute function private.guard_indication_update();
create function public.indication_groups(p_request_id uuid,p_offset integer default 0) returns table(place_id uuid,indications bigint) language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if not private.active(v_actor) or not exists(select 1 from public.requests where id=p_request_id and
 ((requester_id=v_actor and status<>'OPEN' and hidden_at is null) or public.is_admin())) then raise exception 'NOT_ALLOWED'; end if;
 return query select i.place_id,count(*) from public.indications i where i.request_id=p_request_id and i.hidden_at is null
 group by i.place_id order by min(i.created_at),i.place_id limit 11 offset greatest(0,least(p_offset,100000));
end $$;
revoke all on function public.indication_groups(uuid,integer) from public,anon,authenticated;
grant execute on function public.indication_groups(uuid,integer) to authenticated;
