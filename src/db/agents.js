import { randomBytes } from "crypto";
import { supabase } from "./supabase.js";
import { getBotConfig } from "./botConfig.js";

/**
 * Mescla agente + fallback global (bot_config id=1).
 */
export async function getEffectiveAgentConfig(agentRow) {
  const global = await getBotConfig();
  if (!agentRow) return global;

  let ctx = agentRow.empresa_contexto;
  if (typeof ctx === "string") {
    try {
      ctx = JSON.parse(ctx);
    } catch {
      ctx = {};
    }
  }
  if (!ctx || typeof ctx !== "object") ctx = {};

  return {
    empresa_nome: agentRow.empresa_nome ?? global.empresa_nome,
    modelo_gemini: agentRow.modelo_gemini ?? global.modelo_gemini,
    voz: agentRow.voz ?? global.voz,
    quem_fala_primeiro: agentRow.quem_fala_primeiro ?? global.quem_fala_primeiro,
    prompt_template: agentRow.prompt_template?.trim()
      ? agentRow.prompt_template
      : global.prompt_template,
    timeout_segundos: agentRow.timeout_segundos ?? global.timeout_segundos,
    instrucoes_background: agentRow.instrucoes_background ?? "",
    empresa_contexto: ctx,
    webhook_saida_url: agentRow.webhook_saida_url ?? null,
    // Comportamento avançado
    vad_silencio_ms: agentRow.vad_silencio_ms ?? 800,
    vad_sensibilidade_inicio: agentRow.vad_sensibilidade_inicio ?? "START_SENSITIVITY_LOW",
    vad_sensibilidade_fim: agentRow.vad_sensibilidade_fim ?? "END_SENSITIVITY_LOW",
    interrupcao_habilitada: agentRow.interrupcao_habilitada ?? true,
    primeiro_turno_delay_ms: agentRow.primeiro_turno_delay_ms ?? 500,
    silencio_encerrar_seg: agentRow.silencio_encerrar_seg ?? 0,
    deteccao_voicemail: agentRow.deteccao_voicemail ?? false,
  };
}

export async function getAgentById(id) {
  if (!id) return null;
  const { data } = await supabase.from("agents").select("*").eq("id", id).single();
  return data;
}

export async function listAgents({ includeInactive = false } = {}) {
  let q = supabase.from("agents").select("*").order("nome");
  if (!includeInactive) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createAgent(fields) {
  const token = randomBytes(24).toString("hex");
  const row = {
    ...fields,
    webhook_entrada_token: fields.webhook_entrada_token ?? token,
    atualizado_em: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("agents").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateAgent(id, fields) {
  const { data, error } = await supabase
    .from("agents")
    .update({ ...fields, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAgent(id) {
  const { error } = await supabase.from("agents").update({ ativo: false }).eq("id", id);
  if (error) throw error;
}

export async function regenerateInboundToken(id) {
  const token = randomBytes(24).toString("hex");
  return updateAgent(id, { webhook_entrada_token: token });
}

export async function getAgentByInboundToken(token) {
  if (!token) return null;
  const { data } = await supabase.from("agents").select("*").eq("webhook_entrada_token", token).single();
  return data;
}
