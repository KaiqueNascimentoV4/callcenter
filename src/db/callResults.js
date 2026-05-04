import { supabase } from "./supabase.js";

export async function saveCallResult({
  callSid,
  leadId,
  agentId,
  confirmado,
  pessoa_correta,
  interesse,
  humor,
  resumo,
  proxima_acao,
}) {
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("role, texto")
    .eq("call_sid", callSid ?? "")
    .order("ts");

  const transcricao_usuario = (transcripts ?? []).filter((r) => r.role === "user").map((r) => r.texto).join(" ");
  const transcricao_agente = (transcripts ?? []).filter((r) => r.role === "agent").map((r) => r.texto).join(" ");

  const { data, error } = await supabase
    .from("call_results")
    .insert({
      call_sid: callSid ?? null,
      lead_id: leadId ?? null,
      agent_id: agentId ?? null,
      confirmado,
      pessoa_correta,
      interesse,
      humor,
      resumo,
      proxima_acao,
      transcricao_usuario,
      transcricao_agente,
    })
    .select()
    .single();

  if (error) throw error;

  if (leadId) {
    const novoStatus =
      proxima_acao === "nao_contatar"
        ? "nao_contatar"
        : interesse === "alto"
          ? "convertido"
          : "contactado";
    await supabase
      .from("leads")
      .update({ status: novoStatus, ultima_ligacao_em: new Date().toISOString() })
      .eq("id", leadId);
  }

  return data;
}

export async function appendTranscript(callSid, role, texto) {
  if (!callSid || !texto?.trim()) return;
  await supabase.from("transcripts").insert({ call_sid: callSid, role, texto: texto.trim() });
}

/** Junta linhas consecutivas do mesmo papel num único “bubble”. */
export function mergeTranscriptsToBubbles(rows) {
  const sorted = [...(rows ?? [])].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const bubbles = [];
  for (const row of sorted) {
    const last = bubbles[bubbles.length - 1];
    if (last && last.role === row.role) {
      last.texto = `${last.texto} ${row.texto}`.trim();
      last.ts_end = row.ts;
    } else {
      bubbles.push({
        role: row.role,
        texto: row.texto,
        ts: row.ts,
        ts_end: row.ts,
      });
    }
  }
  return bubbles;
}

export async function getTranscriptsByCallSid(callSid) {
  const { data } = await supabase.from("transcripts").select("*").eq("call_sid", callSid).order("ts");
  return data ?? [];
}

export async function getTranscriptsConversation(callSid) {
  const rows = await getTranscriptsByCallSid(callSid);
  return { raw: rows, bubbles: mergeTranscriptsToBubbles(rows) };
}

export async function listCallResults({
  page = 1,
  limit = 50,
  lead_id,
  agent_id,
  interesse,
  humor,
  proxima_acao,
  from: dateFrom,
  to: dateTo,
} = {}) {
  let query = supabase
    .from("call_results")
    .select("*, leads(nome, empresa), agents(nome)", { count: "exact" });

  if (lead_id) query = query.eq("lead_id", lead_id);
  if (agent_id) query = query.eq("agent_id", agent_id);
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

export async function getStatsSummary({ agent_id } = {}) {
  let q = supabase.from("call_results").select("interesse, humor, criado_em, agent_id");
  if (agent_id) q = q.eq("agent_id", agent_id);

  const { data: results } = await q;

  const hoje = new Date().toISOString().slice(0, 10);
  const total = results?.length ?? 0;
  const hoje_count = results?.filter((r) => r.criado_em?.slice(0, 10) === hoje).length ?? 0;
  const alto_interesse = results?.filter((r) => r.interesse === "alto").length ?? 0;
  const convertidos = results?.filter((r) => r.interesse === "alto" || r.interesse === "medio").length ?? 0;

  return {
    total_ligacoes: total,
    ligacoes_hoje: hoje_count,
    taxa_interesse_alto: total ? Math.round((alto_interesse / total) * 100) : 0,
    taxa_conversao: total ? Math.round((convertidos / total) * 100) : 0,
  };
}

export async function getStatsByDate({ from: dateFrom, to: dateTo, agent_id } = {}) {
  let query = supabase.from("call_results").select("criado_em, interesse, agent_id");
  if (dateFrom) query = query.gte("criado_em", dateFrom);
  if (dateTo) query = query.lte("criado_em", dateTo);
  if (agent_id) query = query.eq("agent_id", agent_id);

  const { data } = await query.order("criado_em");

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

export async function getStatsByAgent({ from: dateFrom, to: dateTo } = {}) {
  let query = supabase.from("call_results").select("agent_id, interesse, criado_em");
  if (dateFrom) query = query.gte("criado_em", dateFrom);
  if (dateTo) query = query.lte("criado_em", dateTo);

  const { data } = await query;
  const byAgent = {};
  for (const r of data ?? []) {
    const aid = r.agent_id ?? "none";
    if (!byAgent[aid]) byAgent[aid] = { agent_id: r.agent_id, total: 0, alto: 0 };
    byAgent[aid].total++;
    if (r.interesse === "alto") byAgent[aid].alto++;
  }

  const { data: agentRows } = await supabase.from("agents").select("id, nome");
  const idToName = Object.fromEntries((agentRows ?? []).map((a) => [a.id, a.nome]));

  return Object.values(byAgent).map((row) => ({
    ...row,
    agent_nome: row.agent_id ? idToName[row.agent_id] ?? "—" : "Sem agente",
  }));
}
