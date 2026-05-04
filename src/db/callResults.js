import { supabase } from "./supabase.js";

export async function saveCallResult({ callSid, leadId, confirmado, pessoa_correta, interesse, humor, resumo, proxima_acao }) {
  // Agrega transcrição acumulada
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("role, texto")
    .eq("call_sid", callSid ?? "")
    .order("ts");

  const transcricao_usuario = (transcripts ?? []).filter(r => r.role === "user").map(r => r.texto).join(" ");
  const transcricao_agente = (transcripts ?? []).filter(r => r.role === "agent").map(r => r.texto).join(" ");

  const { data, error } = await supabase.from("call_results").insert({
    call_sid: callSid ?? null,
    lead_id: leadId ?? null,
    confirmado,
    pessoa_correta,
    interesse,
    humor,
    resumo,
    proxima_acao,
    transcricao_usuario,
    transcricao_agente,
  }).select().single();

  if (error) throw error;

  // Atualiza status do lead conforme próxima ação
  if (leadId) {
    const novoStatus = proxima_acao === "nao_contatar" ? "nao_contatar"
      : interesse === "alto" ? "convertido"
      : "contactado";
    await supabase.from("leads").update({ status: novoStatus, ultima_ligacao_em: new Date().toISOString() }).eq("id", leadId);
  }

  return data;
}

export async function appendTranscript(callSid, role, texto) {
  if (!callSid || !texto?.trim()) return;
  await supabase.from("transcripts").insert({ call_sid: callSid, role, texto: texto.trim() });
}

export async function listCallResults({ page = 1, limit = 50, lead_id, interesse, humor, proxima_acao, from: dateFrom, to: dateTo } = {}) {
  let query = supabase
    .from("call_results")
    .select("*, leads(nome, empresa)", { count: "exact" });

  if (lead_id) query = query.eq("lead_id", lead_id);
  if (interesse) query = query.eq("interesse", interesse);
  if (humor) query = query.eq("humor", humor);
  if (proxima_acao) query = query.eq("proxima_acao", proxima_acao);
  if (dateFrom) query = query.gte("criado_em", dateFrom);
  if (dateTo) query = query.lte("criado_em", dateTo);

  const offset = (page - 1) * limit;
  query = query.order("criado_em", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data, count, page, limit };
}

export async function getCallResultById(id) {
  const { data } = await supabase
    .from("call_results")
    .select("*, leads(nome, empresa, telefone)")
    .eq("id", id)
    .single();
  return data;
}

export async function getTranscriptsByCallSid(callSid) {
  const { data } = await supabase
    .from("transcripts")
    .select("*")
    .eq("call_sid", callSid)
    .order("ts");
  return data ?? [];
}

export async function getStatsSummary() {
  const { data: results } = await supabase.from("call_results").select("interesse, humor, criado_em");

  const hoje = new Date().toISOString().slice(0, 10);
  const total = results?.length ?? 0;
  const hoje_count = results?.filter(r => r.criado_em?.slice(0, 10) === hoje).length ?? 0;
  const alto_interesse = results?.filter(r => r.interesse === "alto").length ?? 0;
  const convertidos = results?.filter(r => r.interesse === "alto" || r.interesse === "medio").length ?? 0;

  return {
    total_ligacoes: total,
    ligacoes_hoje: hoje_count,
    taxa_interesse_alto: total ? Math.round((alto_interesse / total) * 100) : 0,
    taxa_conversao: total ? Math.round((convertidos / total) * 100) : 0,
  };
}

export async function getStatsByDate({ from: dateFrom, to: dateTo } = {}) {
  let query = supabase.from("call_results").select("criado_em, interesse");
  if (dateFrom) query = query.gte("criado_em", dateFrom);
  if (dateTo) query = query.lte("criado_em", dateTo);

  const { data } = await query.order("criado_em");

  // Agrupa por dia
  const byDay = {};
  for (const r of data ?? []) {
    const day = r.criado_em?.slice(0, 10);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = { date: day, total: 0, alto: 0 };
    byDay[day].total++;
    if (r.interesse === "alto") byDay[day].alto++;
  }

  return Object.values(byDay);
}
