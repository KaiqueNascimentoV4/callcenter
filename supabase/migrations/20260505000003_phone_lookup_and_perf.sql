ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS telefone_normalizado text;

UPDATE public.leads
SET telefone_normalizado = '+' || regexp_replace(coalesce(telefone, ''), '\D', '', 'g')
WHERE coalesce(telefone, '') <> ''
  AND (
    telefone_normalizado IS NULL
    OR telefone_normalizado = ''
  );

CREATE INDEX IF NOT EXISTS leads_phone_normalized_idx
  ON public.leads (telefone_normalizado);

CREATE INDEX IF NOT EXISTS leads_agent_status_criado_em_idx
  ON public.leads (agent_id, status, criado_em DESC)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS call_results_agent_created_desc_idx
  ON public.call_results (agent_id, criado_em DESC)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS call_results_lead_created_desc_idx
  ON public.call_results (lead_id, criado_em DESC)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transcripts_call_sid_ts_desc_idx
  ON public.transcripts (call_sid, ts DESC);

ANALYZE public.leads;
ANALYZE public.call_results;
ANALYZE public.transcripts;
