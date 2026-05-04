-- Extensão para buscas ILIKE %% mais rápidas em texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Listagem de leads: ORDER BY criado_em DESC + filtros frequentes
CREATE INDEX IF NOT EXISTS leads_criado_em_desc_idx ON public.leads (criado_em DESC);
CREATE INDEX IF NOT EXISTS leads_status_criado_em_idx ON public.leads (status, criado_em DESC);
CREATE INDEX IF NOT EXISTS leads_campaign_criado_em_idx ON public.leads (campaign_id, criado_em DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_agent_criado_em_idx ON public.leads (agent_id, criado_em DESC) WHERE agent_id IS NOT NULL;

-- Busca OR ilike em nome / empresa / telefone (listLeads com q)
CREATE INDEX IF NOT EXISTS leads_nome_trgm_idx ON public.leads USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_empresa_trgm_idx ON public.leads USING gin (empresa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_telefone_trgm_idx ON public.leads USING gin (telefone gin_trgm_ops);

-- Agentes: WHERE ativo = true ORDER BY nome
CREATE INDEX IF NOT EXISTS agents_ativo_nome_idx ON public.agents (ativo, nome);

-- Resultados: filtros + ordenação por data
CREATE INDEX IF NOT EXISTS call_results_agent_criado_em_idx ON public.call_results (agent_id, criado_em DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_results_lead_criado_em_idx ON public.call_results (lead_id, criado_em DESC) WHERE lead_id IS NOT NULL;

-- Transcrições: ORDER BY ts por call_sid (mergeTranscripts / listagens)
CREATE INDEX IF NOT EXISTS transcripts_call_sid_ts_idx ON public.transcripts (call_sid, ts);

ANALYZE public.leads;
ANALYZE public.agents;
ANALYZE public.call_results;
ANALYZE public.transcripts;
