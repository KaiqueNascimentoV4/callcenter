import { supabase } from "./supabase.js";

export async function getBotConfig() {
  const { data } = await supabase.from("bot_config").select("*").eq("id", 1).single();
  return data ?? {
    empresa_nome: process.env.EMPRESA_NOME ?? "Minha Empresa",
    modelo_gemini: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-live-preview",
    voz: process.env.GEMINI_VOICE ?? "Kore",
    quem_fala_primeiro: "agente",
    prompt_template: "",
    timeout_segundos: 120,
  };
}

export async function updateBotConfig(fields) {
  const { data, error } = await supabase
    .from("bot_config")
    .upsert({ id: 1, ...fields, atualizado_em: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}
