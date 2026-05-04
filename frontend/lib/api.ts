"use client";

/**
 * Base da API REST — por defeito **`/api-ext`** (mesmo origin que o frontend na Vercel).
 * Assim o browser não faz pedido cross-origin → não há bloqueio CORS nem páginas 502 do Traefik sem cabeçalhos CORS.
 * O Next faz proxy em `app/api-ext/[[...path]]/route.ts` → `BACKEND_PROXY_TARGET`.
 *
 * Só uses URL absoluta se configurares CORS no Express para esse origin:
 * `NEXT_PUBLIC_API_BASE=https://api-call...`
 */
function apiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE?.trim().replace(/\/$/, "");
  return env || "/api-ext";
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: HeadersInit = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...init?.headers,
  };
  const res = await fetch(url, {
    ...init,
    headers,
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

// ── Results ────────────────────────────────────────────────────────────────

export const resultsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return req<{ data: CallResult[]; count: number }>(`/results${qs}`);
  },
  get: (id: string) => req<CallResult>(`/results/${id}`),
  transcripts: (callSid: string) => req<Transcript[]>(`/transcripts/${callSid}`),
  conversation: (callSid: string) =>
    req<{
      raw: Transcript[];
      bubbles: { role: "user" | "agent"; texto: string; ts: string; ts_end?: string }[];
    }>(`/transcripts/${callSid}/conversation`),
};

// ── Campaigns ─────────────────────────────────────────────────────────────

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

// ── Agents ─────────────────────────────────────────────────────────────────

export const agentsApi = {
  list: (includeInactive?: boolean) =>
    req<Agent[]>(`/agents${includeInactive ? "?include_inactive=true" : ""}`),
  get: (id: string) => req<Agent>(`/agents/${id}`),
  create: (body: Partial<Agent>) => req<Agent>("/agents", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Agent>) => req<Agent>(`/agents/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => req(`/agents/${id}`, { method: "DELETE" }),
  regenerateToken: (id: string) => req<Agent>(`/agents/${id}/regenerate-token`, { method: "POST" }),
  voicePreviewUrl: (id: string) => {
    const base = apiBaseUrl();
    const path = `/agents/${id}/voice-preview`;
    if (base.startsWith("http")) return `${base}${path}`;
    return `${typeof window !== "undefined" ? window.location.origin : ""}${base}${path}`;
  },
};

// ── Bot Config ────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => req<BotConfig>("/bot-config"),
  update: (body: Partial<BotConfig>) => req<BotConfig>("/bot-config", { method: "PUT", body: JSON.stringify(body) }),
};

// ── Stats ─────────────────────────────────────────────────────────────────

export const statsApi = {
  summary: (params?: { agent_id?: string }) => {
    const qs = params?.agent_id ? `?agent_id=${encodeURIComponent(params.agent_id)}` : "";
    return req<StatsSummary>(`/stats/summary${qs}`);
  },
  byDate: (params?: { from?: string; to?: string; agent_id?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return req<DateStat[]>(`/stats/by-date${qs}`);
  },
  byAgent: (params?: { from?: string; to?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return req<AgentStatRow[]>(`/stats/by-agent${qs}`);
  },
};

// ── Types ─────────────────────────────────────────────────────────────────

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
  agent_id?: string | null;
  payload_extras?: Record<string, unknown>;
  status: "novo" | "contactado" | "convertido" | "nao_contatar" | "arquivado";
  ultima_ligacao_em?: string;
  tentativas: number;
  criado_em: string;
  agents?: { nome: string } | null;
};

export type Agent = {
  id: string;
  nome: string;
  ativo: boolean;
  empresa_nome?: string | null;
  empresa_contexto?: Record<string, unknown> | null;
  prompt_template?: string;
  instrucoes_background?: string;
  modelo_gemini?: string;
  voz?: string;
  timeout_segundos?: number;
  quem_fala_primeiro?: "agente" | "usuario";
  webhook_saida_url?: string | null;
  webhook_entrada_token?: string | null;
  telefone_json_path?: string | null;
  criado_em?: string;
  atualizado_em?: string;
};

export type AgentStatRow = {
  agent_id: string | null;
  agent_nome: string;
  total: number;
  alto: number;
};

export type InfoChave = { id: number; lead_id: string; chave: string; valor: string; criado_em: string };

export type CallResult = {
  id: number;
  call_sid: string;
  lead_id: string;
  agent_id?: string | null;
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
  agents?: { nome: string } | null;
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

export type UserApproval = {
  id: string;
  user_id: string;
  email: string;
  approved: boolean;
  admin: boolean;
  approved_at: string | null;
  created_at: string;
};

export const adminApi = {
  listUsers: () => req<UserApproval[]>("/admin/users"),
  patchUser: (userId: string, fields: Partial<Pick<UserApproval, "approved" | "admin">>) =>
    req<UserApproval>(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(fields) }),
};
