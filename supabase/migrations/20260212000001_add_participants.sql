-- Human participants table: team members displayed alongside AI agents
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id),
  name text not null,
  role_title text not null,
  avatar_url text,
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz not null default now()
);

create index idx_participants_user_id on public.participants(user_id);

-- RLS: anyone can read, only service_role can write
alter table public.participants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'participants_select' and tablename = 'participants') then
    create policy participants_select on public.participants for select using (true);
  end if;
end $$;

-- Seed the owner as the first participant
insert into public.participants (user_id, name, role_title, display_order)
values ('00000000-0000-0000-0000-000000000001', 'De Vinci', 'Founder', 0)
on conflict (user_id) do nothing;
