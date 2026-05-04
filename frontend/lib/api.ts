/** No browser: mesmo domínio via rewrite (/api-ext → API), evita CORS. No servidor: URL direta (sem CORS). */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api-ext";
  }
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:3000"
  );
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ── Leads ────────────────────────────────────────────────────────────────────

export const leadsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<{ data: Lead[]; count: number }>(`/leads${qs}`);
  },
  get: (id: string) => req<Lead & { info_chave: InfoChave[]; historico_ligacoes: CallResult[] }>(`/leads/${id}`),
  create: (body: Partial<Lead>) => req<Lead>("/leads", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Lead>) => req<Lead>(`/leads/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => req(`/leads/${id}`, { method: "DELETE" }),
  addInfo: (id: string, chave: string, valor: string) =>
    req(`/leads/${id}/info`, { method: "POST", body: JSON.stringify({ chave, valor }) }),
  import: (leads: Partial<Lead>[]) => req("/leads/import", { method: "POST", body: JSON.stringify({ leads }) }),
  call: (leadId: string, campaignId?: string) =>
    req<{ callSid: string; status: string }>("/calls/start", {
      method: "POST",
      body: JSON.stringify({ leadId, campaignId }),
    }),
};

// ── Results ──────────────────────────────────────────────────────────────────

export const resultsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<{ data: CallResult[]; count: number }>(`/results${qs}`);
  },
  get: (id: string) => req<CallResult>(`/results/${id}`),
  transcripts: (callSid: string) => req<Transcript[]>(`/transcripts/${callSid}`),
};

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const campaignsApi = {
  list: () => req<Campaign[]>("/campaigns"),
  get: (id: string) => req<Campaign>(`/campaigns/${id}`),
  create: (body: Partial<Campaign>) => req<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Campaign>) =>
    req<Campaign>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => req(`/campaigns/${id}`, { method: "DELETE" }),
  stats: (id: string) => req<CampaignStats>(`/campaigns/${id}/stats`),
  dispatch: (id: string) => req(`/campaigns/${id}/dispatch`, { method: "POST" }),
};

// ── Bot Config ────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => req<BotConfig>("/bot-config"),
  update: (body: Partial<BotConfig>) => req<BotConfig>("/bot-config", { method: "PUT", body: JSON.stringify(body) }),
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const statsApi = {
  summary: () => req<StatsSummary>("/stats/summary"),
  byDate: (params?: { from?: string; to?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return req<DateStat[]>(`/stats/by-date${qs}`);
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type Lead = {
  id: string;
  nome: string;
  empresa?: string;
  cargo?: string;
  telefone: string;
  origem?: string;
  objetivo?: string;
  oferta?: string;
  campaign_id?: string;
  status: "novo" | "contactado" | "convertido" | "nao_contatar" | "arquivado";
  ultima_ligacao_em?: string;
  tentativas: number;
  criado_em: string;
};

export type InfoChave = { id: number; lead_id: string; chave: string; valor: string; criado_em: string };

export type CallResult = {
  id: number;
  call_sid: string;
  lead_id: string;
  confirmado: boolean;
  pessoa_correta: boolean;
  interesse: "alto" | "medio" | "baixo" | "sem_interesse" | "incerto";
  humor: "positivo" | "neutro" | "negativo" | "irritado" | "incerto";
  resumo: string;
  proxima_acao: "enviar_whatsapp" | "enviar_email" | "agendar_reuniao" | "nao_contatar" | "revisar_manualmente";
  transcricao_usuario: string;
  transcricao_agente: string;
  criado_em: string;
  leads?: { nome: string; empresa?: string; telefone?: string };
};

export type Transcript = { id: number; call_sid: string; role: "user" | "agent"; texto: string; ts: string };

export type Campaign = {
  id: string;
  nome: string;
  descricao?: string;
  objetivo?: string;
  oferta?: string;
  ativo: boolean;
  criado_em: string;
  leads?: Lead[];
};

export type CampaignStats = {
  total_leads: number;
  contactados: number;
  pendentes: number;
  taxa_interesse_alto: number;
};

export type BotConfig = {
  empresa_nome: string;
  modelo_gemini: string;
  voz: string;
  quem_fala_primeiro: "agente" | "usuario";
  prompt_template: string;
  timeout_segundos: number;
};

export type StatsSummary = {
  total_ligacoes: number;
  ligacoes_hoje: number;
  taxa_interesse_alto: number;
  taxa_conversao: number;
};

export type DateStat = { date: string; total: number; alto: number };
