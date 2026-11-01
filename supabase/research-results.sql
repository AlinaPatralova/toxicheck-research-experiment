-- Run once in the SQL Editor of the separate RESEARCH Supabase project.
create table if not exists public.research_results (
  participant_id text primary key,
  sequence_id text not null check (sequence_id in ('A', 'B', 'C', 'D')),
  revision bigint not null check (revision > 0),
  write_token_hash text not null check (write_token_hash ~ '^[a-f0-9]{64}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_results enable row level security;
revoke all on public.research_results from public, anon, authenticated;
grant select, insert, update on public.research_results to service_role;

-- One transaction, one row per participant, no public execution or public reads.
create or replace function public.save_research_result(
  p_participant_id text, p_sequence_id text, p_revision bigint,
  p_write_token_hash text, p_data jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  previous public.research_results%rowtype;
  merged_attempts jsonb;
  merged_events jsonb;
  merged_data jsonb;
begin
  if p_data->>'participant_id' is distinct from p_participant_id
    or p_data->>'sequence_id' is distinct from p_sequence_id
    or jsonb_typeof(p_data->'attempts') is distinct from 'array'
    or jsonb_typeof(p_data->'events') is distinct from 'array' then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;

  insert into public.research_results(participant_id, sequence_id, revision, write_token_hash, data)
  values (p_participant_id, p_sequence_id, p_revision, p_write_token_hash, p_data)
  on conflict (participant_id) do nothing;

  select * into strict previous from public.research_results
    where participant_id = p_participant_id for update;
  if previous.write_token_hash <> p_write_token_hash then
    raise exception 'Invalid write token' using errcode = '42501';
  end if;
  if previous.sequence_id <> p_sequence_id then
    raise exception 'Sequence cannot change' using errcode = '22023';
  end if;
  if previous.data->>'collection_environment' is distinct from p_data->>'collection_environment' then
    raise exception 'Collection environment cannot change' using errcode = '22023';
  end if;

  -- Final attempts and existing events are immutable. A delayed start is harmless.
  if exists (
    select 1 from jsonb_array_elements(previous.data->'attempts') old_a
    join jsonb_array_elements(p_data->'attempts') new_a
      on old_a->>'attempt_id' = new_a->>'attempt_id'
    where old_a->>'scenario_id' is distinct from new_a->>'scenario_id'
      or old_a->>'start_time' is distinct from new_a->>'start_time'
      or old_a->>'condition' is distinct from new_a->>'condition'
  ) or exists (
    select 1 from jsonb_array_elements(previous.data->'attempts') old_a
    join jsonb_array_elements(p_data->'attempts') new_a
      on old_a->>'attempt_id' = new_a->>'attempt_id'
    where old_a->>'status' <> 'started' and new_a->>'status' <> 'started' and old_a <> new_a
  ) or exists (
    select 1 from jsonb_array_elements(previous.data->'events') old_e
    join jsonb_array_elements(p_data->'events') new_e
      on old_e->>'event_id' = new_e->>'event_id'
    where old_e <> new_e
  ) then
    raise exception 'Conflicting immutable record' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(a order by a->>'start_time', a->>'attempt_id'), '[]'::jsonb)
  into merged_attempts from (
    select distinct on (a->>'attempt_id') a
    from jsonb_array_elements((previous.data->'attempts') || (p_data->'attempts'))
      with ordinality as entries(a, position)
    order by a->>'attempt_id', (a->>'status' <> 'started') desc,
      case when p_revision >= previous.revision then position else -position end desc
  ) unique_attempts;

  select coalesce(jsonb_agg(e order by position), '[]'::jsonb)
  into merged_events from (
    select distinct on (e->>'event_id') e, position
    from jsonb_array_elements((previous.data->'events') || (p_data->'events'))
      with ordinality as entries(e, position)
    order by e->>'event_id', position
  ) unique_events;

  if jsonb_array_length(merged_attempts) > 100 or jsonb_array_length(merged_events) > 10000 then
    raise exception 'Participant limit exceeded' using errcode = '22023';
  end if;
  merged_data := case when p_revision >= previous.revision then p_data else previous.data end;
  merged_data := jsonb_set(jsonb_set(merged_data, '{attempts}', merged_attempts), '{events}', merged_events);
  update public.research_results set data = merged_data,
    revision = greatest(previous.revision, p_revision), updated_at = clock_timestamp()
    where participant_id = p_participant_id;
  return jsonb_build_object('revision', greatest(previous.revision, p_revision));
end;
$$;

revoke all on function public.save_research_result(text, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_research_result(text, text, bigint, text, jsonb) to service_role;
