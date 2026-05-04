-- Agentes (configuração por “persona” / agente de voz)
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  empresa_nome text,
  empresa_contexto jsonb default '{}'::jsonb,
  prompt_template text default '',
  instrucoes_background text default '',
  modelo_gemini text default 'gemini-2.0-flash-live-001',
  voz text default 'Kore',
  timeout_segundos int default 120,
  quem_fala_primeiro text default 'agente' check (quem_fala_primeiro in ('agente', 'usuario')),
  webhook_saida_url text,
  webhook_entrada_token text unique,
  telefone_json_path text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists agents_ativo_idx on public.agents (ativo);

-- Leads: agente opcional + payload livre (webhook entrada)
alter table public.leads
  add column if not exists agent_id uuid references public.agents (id) on delete set null;

alter table public.leads
  add column if not exists payload_extras jsonb default '{}'::jsonb;

create index if not exists leads_agent_id_idx on public.leads (agent_id);

-- Resultados: permitir stats por agente
alter table public.call_results
  add column if not exists agent_id uuid references public.agents (id) on delete set null;

create index if not exists call_results_agent_id_idx on public.call_results (agent_id);

-- Campanhas: agente default (opcional)
alter table public.campaigns
  add column if not exists agent_id uuid references public.agents (id) on delete set null;
