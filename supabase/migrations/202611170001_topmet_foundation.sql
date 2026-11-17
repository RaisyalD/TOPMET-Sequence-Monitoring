-- TOPMET Stage 1 foundation. Run with the Supabase SQL editor or CLI.
create extension if not exists pgcrypto;

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  display_name text not null, recorded_on date, status text, rank integer,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
); 
create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(), machine_id uuid not null references public.machines(id) on delete cascade,
  trial_key text not null, phases jsonb not null default '{}'::jsonb, duration_seconds numeric,
  unique(machine_id, trial_key)
);
create table if not exists public.components (
  id uuid primary key default gen_random_uuid(), name text not null unique
);
create table if not exists public.sequence_samples (
  id bigint generated always as identity primary key, trial_id uuid not null references public.trials(id) on delete cascade,
  time_seconds numeric not null, unique(trial_id, time_seconds)
);
create table if not exists public.component_states (
  trial_id uuid not null references public.trials(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  time_seconds numeric not null, state boolean not null,
  primary key(trial_id, component_id, time_seconds)
);
create table if not exists public.pressure_channels (
  id uuid primary key default gen_random_uuid(), trial_id uuid not null references public.trials(id) on delete cascade,
  name text not null, normalized_name text not null, unit text not null default 'mbar',
  unique(trial_id, normalized_name)
);
create table if not exists public.pressure_samples (
  channel_id uuid not null references public.pressure_channels(id) on delete cascade,
  time_seconds numeric not null, value numeric, primary key(channel_id, time_seconds)
);
create table if not exists public.hmi_parameters (
  id bigint generated always as identity primary key, trial_id uuid not null references public.trials(id) on delete cascade,
  parameter_name text not null, parameter_value text, unit text
);
create table if not exists public.machine_scores (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  score numeric, status text, rank integer, indicators jsonb not null default '{}'::jsonb
);
create table if not exists public.maintenance_insights (
  id uuid primary key default gen_random_uuid(), machine_id uuid references public.machines(id) on delete cascade,
  severity text not null, title text not null, message text, recommendation text
);

do $$ declare t text; begin
  foreach t in array array['machines','trials','components','sequence_samples','component_states','pressure_channels','pressure_samples','hmi_parameters','machine_scores','maintenance_insights'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated users can read %1$I" on public.%1$I', t);
    execute format('drop policy if exists "authenticated users can write %1$I" on public.%1$I', t);
    execute format('create policy "authenticated users can read %1$I" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "authenticated users can write %1$I" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.machines;
alter publication supabase_realtime add table public.trials;
alter publication supabase_realtime add table public.sequence_samples;
alter publication supabase_realtime add table public.pressure_channels;
alter publication supabase_realtime add table public.pressure_samples;
alter publication supabase_realtime add table public.component_states;
alter publication supabase_realtime add table public.hmi_parameters;
alter publication supabase_realtime add table public.machine_scores;
alter publication supabase_realtime add table public.maintenance_insights;
