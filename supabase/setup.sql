-- Einmal vollständig im SQL Editor des Supabase-Projekts ausführen.
-- Wiederholbar, löscht keine vorhandenen Buchungen.
begin;

create table if not exists public.parking_reservations (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  space_id text not null check (space_id in ('P1','P2','P3','P4')),
  employee_id text not null check (employee_id in
    ('emp-01','emp-02','emp-03','emp-04','emp-05','emp-06','emp-07','emp-08','emp-09')),
  created_at timestamptz not null default now(),
  constraint parking_space_day unique (date, space_id),
  constraint parking_employee_day unique (date, employee_id),
  constraint parking_weekday check (extract(isodow from date) between 1 and 5)
);
alter table public.parking_reservations enable row level security;
revoke all on public.parking_reservations from public, anon, authenticated;

-- Die Funktionen sind die einzige öffentliche Schnittstelle.
-- Kein Login: Die Mitarbeiter-ID ist eine Auswahl, keine verifizierte Identität.
create or replace function public.parking_list()
returns setof public.parking_reservations
language sql stable security definer set search_path = '' as $$
  select * from public.parking_reservations
  where date between date_trunc('week', now() at time zone 'Europe/Vienna')::date
    and date_trunc('week', now() at time zone 'Europe/Vienna')::date + 18
  order by date, space_id;
$$;

create or replace function public.parking_reserve(p_date date, p_space_id text, p_employee_id text)
returns public.parking_reservations
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Vienna')::date;
  v_constraint text;
  v_result public.parking_reservations;
begin
  if p_date is null or p_date < v_today
    or p_date > date_trunc('week', v_today)::date + 18
    or extract(isodow from p_date) not between 1 and 5 then
    raise exception 'Dieser Tag liegt außerhalb des buchbaren Zeitraums.';
  end if;
  if p_employee_id is null or p_employee_id not in
    ('emp-01','emp-02','emp-03','emp-04','emp-05','emp-06','emp-07','emp-08','emp-09') then
    raise exception 'Bitte wähle einen gültigen Namen.';
  end if;
  if p_space_id is null or p_space_id not in ('P1','P2','P3','P4') then
    raise exception 'Unbekannter Parkplatz.';
  end if;
  insert into public.parking_reservations (date,space_id,employee_id)
    values (p_date,p_space_id,p_employee_id) returning * into v_result;
  return v_result;
exception when unique_violation then
  get stacked diagnostics v_constraint = CONSTRAINT_NAME;
  if v_constraint = 'parking_employee_day' then
    raise exception 'Du hast für diesen Tag bereits einen Parkplatz reserviert.';
  end if;
  raise exception 'Dieser Parkplatz ist bereits reserviert.';
end;
$$;

create or replace function public.parking_cancel(p_id uuid, p_employee_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Vienna')::date;
begin
  delete from public.parking_reservations
    where id = p_id and employee_id = p_employee_id
      and date between v_today and date_trunc('week', v_today)::date + 18;
  if not found then
    raise exception 'Stornieren nicht möglich: Die Buchung fehlt, ist vergangen oder gehört einem anderen Namen.';
  end if;
end;
$$;

-- Funktionen sind in PostgreSQL sonst standardmäßig für PUBLIC ausführbar.
revoke all on function public.parking_list() from public;
revoke all on function public.parking_reserve(date,text,text) from public;
revoke all on function public.parking_cancel(uuid,text) from public;
grant usage on schema public to anon, authenticated;
grant execute on function public.parking_list() to anon, authenticated;
grant execute on function public.parking_reserve(date,text,text) to anon, authenticated;
grant execute on function public.parking_cancel(uuid,text) to anon, authenticated;
commit;
