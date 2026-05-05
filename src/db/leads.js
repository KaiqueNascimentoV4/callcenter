import { supabase } from "./supabase.js";

export function normalizePhone(phone) {
  const digits = String(phone ?? "").replace(/\D+/g, "");
  return digits ? `+${digits}` : null;
}

function withNormalizedPhone(lead = {}) {
  const normalized = normalizePhone(lead.telefone);
  return {
    ...lead,
    ...(normalized ? { telefone: normalized, telefone_normalizado: normalized } : {}),
  };
}

export async function getLeadById(id) {
  const { data } = await supabase
    .from("leads")
    .select("id, nome, empresa, cargo, telefone, telefone_normalizado, origem, objetivo, oferta, campaign_id, agent_id, payload_extras, status, ultima_ligacao_em, tentativas, criado_em, agents(id, nome, voz, modelo_gemini, webhook_entrada_token)")
    .eq("id", id)
    .single();
  return data;
}

export async function listLeads({ page = 1, limit = 50, status, campaign_id, agent_id, q } = {}) {
  let query = supabase
    .from("leads")
    .select("id, nome, empresa, cargo, telefone, campaign_id, agent_id, status, ultima_ligacao_em, tentativas, criado_em, campaigns(id, nome), agents(id, nome)", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (campaign_id) query = query.eq("campaign_id", campaign_id);
  if (agent_id) query = query.eq("agent_id", agent_id);
  if (q) {
    const normalized = normalizePhone(q);
    const phoneOr = normalized
      ? `telefone.ilike.%${q}%,telefone_normalizado.eq.${normalized}`
      : `telefone.ilike.%${q}%`;
    query = query.or(`nome.ilike.%${q}%,empresa.ilike.%${q}%,${phoneOr}`);
  }

  const from = (page - 1) * limit;
  query = query.order("criado_em", { ascending: false }).range(from, from + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data, count, page, limit };
}

export async function upsertLead(lead) {
  const row = withNormalizedPhone(lead);
  const { data, error } = await supabase
    .from("leads")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id, fields) {
  const row = withNormalizedPhone(fields);
  const { data, error } = await supabase
    .from("leads")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id) {
  const { error } = await supabase
    .from("leads")
    .update({ status: "arquivado" })
    .eq("id", id);
  if (error) throw error;
}

export async function bulkArchiveLeads(ids = []) {
  const uniqueIds = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (uniqueIds.length === 0) return { count: 0 };

  const { data, error } = await supabase
    .from("leads")
    .update({ status: "arquivado" })
    .in("id", uniqueIds)
    .select("id");
  if (error) throw error;
  return { count: data?.length ?? 0 };
}

export async function bulkAssignLeads({ ids = [], agent_id, campaign_id }) {
  const uniqueIds = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (uniqueIds.length === 0) return { count: 0 };

  const fields = {};
  if (typeof agent_id !== "undefined") fields.agent_id = agent_id;
  if (typeof campaign_id !== "undefined") fields.campaign_id = campaign_id;

  const { data, error } = await supabase
    .from("leads")
    .update(fields)
    .in("id", uniqueIds)
    .select("id");
  if (error) throw error;
  return { count: data?.length ?? 0 };
}

export async function saveLeadInfoChave(leadId, chave, valor) {
  const { error } = await supabase
    .from("lead_info_chave")
    .insert({ lead_id: leadId, chave, valor });
  if (error) throw error;
}

export async function getLeadInfoChave(leadId) {
  const { data } = await supabase
    .from("lead_info_chave")
    .select("*")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false });
  return data ?? [];
}

export async function bulkImportLeads(leads) {
  const rows = (leads ?? []).map(withNormalizedPhone);
  const { data, error } = await supabase
    .from("leads")
    .upsert(rows, { onConflict: "id" })
    .select();
  if (error) throw error;
  return data;
}

export async function getLatestLeadByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, empresa, cargo, telefone, telefone_normalizado, agent_id, campaign_id, payload_extras, status, ultima_ligacao_em, criado_em")
    .eq("telefone_normalizado", normalized)
    .order("ultima_ligacao_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function incrementLeadAttempts(id) {
  await supabase.rpc("increment_lead_attempts", { lead_id: id }).catch(() => {
    // fallback se a RPC não existir
    supabase.from("leads").update({ ultima_ligacao_em: new Date().toISOString() }).eq("id", id);
  });
  await supabase
    .from("leads")
    .update({ ultima_ligacao_em: new Date().toISOString(), status: "contactado" })
    .eq("id", id)
    .eq("status", "novo");
}
