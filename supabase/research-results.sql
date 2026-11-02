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

  -- Allocation metadata is server-owned and cannot be supplied by an upload.
  p_data := p_data - 'assignment';
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
  if previous.data ? 'assignment' then
    p_data := jsonb_set(jsonb_set(p_data, '{assignment}', previous.data->'assignment'),
      '{collection_environment}', previous.data->'collection_environment');
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

-- One existing results table also stores durable allocation slots. Legacy rows
-- and manual test links do not consume slots. Production and Preview are separate.
create unique index if not exists research_allocation_slot
on public.research_results ((data->>'collection_environment'),
  ((data->'assignment'->>'position')::bigint))
where data->'assignment'->>'source' = 'automatic';

create or replace function public.assign_research_sequence(
  p_participant_id text, p_write_token_hash text, p_created_at text,
  p_environment text, p_requested_sequence text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  previous public.research_results%rowtype;
  assigned text;
  environment text;
  slot bigint;
  allocation jsonb;
  snapshot jsonb;
begin
  if p_participant_id is null or p_participant_id !~ '^participant_[A-Za-z0-9_-]{1,168}$'
    or p_write_token_hash is null or p_write_token_hash !~ '^[a-f0-9]{64}$'
    or p_environment is null or p_environment not in ('production', 'test')
    or (p_requested_sequence is not null and p_requested_sequence not in ('A','B','C','D'))
    or p_created_at is null or length(p_created_at) > 40 then
    raise exception 'Invalid allocation request' using errcode = '22023';
  end if;
  perform p_created_at::timestamptz;

  -- Transaction-scoped, database-wide: concurrent Vercel instances cannot use
  -- the same remaining slot. The lock is released on commit AND on failure.
  perform pg_advisory_xact_lock(713246982::bigint);
  select * into previous from public.research_results where participant_id = p_participant_id;
  if found then
    if previous.write_token_hash <> p_write_token_hash then
      raise exception 'Invalid write token' using errcode = '42501';
    end if;
    return jsonb_build_object('participant_id', previous.participant_id,
      'sequence_id', previous.sequence_id, 'created_at', previous.data->'session'->>'createdAt',
      'collection_environment', previous.data->>'collection_environment',
      'assignment', previous.data->'assignment');
  end if;

  environment := case when p_requested_sequence is not null then 'test' else p_environment end;
  if p_requested_sequence is not null then
    assigned := p_requested_sequence;
    allocation := jsonb_build_object('source', 'manual');
  else
    select coalesce(max((data->'assignment'->>'position')::bigint), 0) + 1 into slot
    from public.research_results
    where data->>'collection_environment' = environment
      and data->'assignment'->>'source' = 'automatic';
    select candidate into assigned from unnest(array['A','B','C','D']) candidate
    where not exists (
      select 1 from public.research_results r
      where r.data->>'collection_environment' = environment
        and r.data->'assignment'->>'source' = 'automatic'
        and ((r.data->'assignment'->>'position')::bigint - 1) / 4 = (slot - 1) / 4
        and r.sequence_id = candidate
    ) order by random() limit 1;
    if assigned is null then
      raise exception 'Allocation block inconsistent' using errcode = '22023';
    end if;
    allocation := jsonb_build_object('source', 'automatic', 'position', slot, 'block', (slot - 1) / 4 + 1);
  end if;

  snapshot := jsonb_build_object('schema_version', 1, 'experiment_version', 'collection-v1',
    'participant_id', p_participant_id, 'sequence_id', assigned,
    'collection_environment', environment, 'assignment', allocation,
    'session', jsonb_build_object('participantId', p_participant_id, 'sequenceId', assigned,
      'createdAt', p_created_at, 'stage', 'training', 'currentTaskIndex', 0,
      'activeTaskStartedAt', null, 'lastAttemptId', null),
    'attempts', '[]'::jsonb, 'events', '[]'::jsonb);
  insert into public.research_results(participant_id, sequence_id, revision, write_token_hash, data)
  values (p_participant_id, assigned, 1, p_write_token_hash, snapshot);
  return jsonb_build_object('participant_id', p_participant_id, 'sequence_id', assigned,
    'created_at', p_created_at, 'collection_environment', environment, 'assignment', allocation);
end;
$$;

revoke all on function public.assign_research_sequence(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.assign_research_sequence(text, text, text, text, text) to service_role;
