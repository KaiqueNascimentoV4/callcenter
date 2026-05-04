import { supabase } from "./supabase.js";

export async function listCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, leads(count)")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCampaignById(id) {
  const { data } = await supabase
    .from("campaigns")
    .select("*, leads(*)")
    .eq("id", id)
    .single();
  return data;
}

export async function createCampaign(fields) {
  const { data, error } = await supabase.from("campaigns").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(id, fields) {
  const { data, error } = await supabase.from("campaigns").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(id) {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function getCampaignStats(id) {
  const { data: leads } = await supabase.from("leads").select("id, status").eq("campaign_id", id);
  const { data: results } = await supabase
    .from("call_results")
    .select("interesse")
    .in("lead_id", (leads ?? []).map(l => l.id));

  const total = leads?.length ?? 0;
  const contactados = leads?.filter(l => l.status !== "novo").length ?? 0;
  const alto = results?.filter(r => r.interesse === "alto").length ?? 0;

  return {
    total_leads: total,
    contactados,
    pendentes: total - contactados,
    taxa_interesse_alto: results?.length ? Math.round((alto / results.length) * 100) : 0,
  };
}
