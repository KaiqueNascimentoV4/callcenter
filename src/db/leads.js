import { supabase } from "./supabase.js";

export async function getLeadById(id) {
  const { data } = await supabase.from("leads").select("*, agents(*)").eq("id", id).single();
  return data;
}

export async function listLeads({ page = 1, limit = 50, status, campaign_id, agent_id, q } = {}) {
  let query = supabase.from("leads").select("*, campaigns(nome), agents(nome)", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (campaign_id) query = query.eq("campaign_id", campaign_id);
  if (agent_id) query = query.eq("agent_id", agent_id);
  if (q) query = query.or(`nome.ilike.%${q}%,empresa.ilike.%${q}%,telefone.ilike.%${q}%`);

  const from = (page - 1) * limit;
  query = query.order("criado_em", { ascending: false }).range(from, from + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data, count, page, limit };
}

export async function upsertLead(lead) {
  const { data, error } = await supabase
    .from("leads")
    .upsert(lead, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id, fields) {
  const { data, error } = await supabase
    .from("leads")
    .update(fields)
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
  const { data, error } = await supabase
    .from("leads")
    .upsert(leads, { onConflict: "id" })
    .select();
  if (error) throw error;
  return data;
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
