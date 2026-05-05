import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripJsonFences(text: string) {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t;
}

function safeJsonParse(text: string) {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Resposta da IA não está em JSON válido.");
  }
}

function toStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

function toObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verificar se o usuário está autenticado
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { error: authError } = await supabase.auth.getUser();
  if (authError) return json({ error: "Sessão inválida." }, 401);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY não configurada no servidor." }, 500);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido (JSON)." }, 400);
  }

  const prompt = `
Você é um especialista em roteiros de atendimento por voz (SDR/qualificação) em PT-BR.
Gere um JSON ESTRITO (sem markdown) com as chaves:
- prompt_template (string): roteiro principal com placeholders {{nome}}, {{empresa}}, {{cargo}}, {{origem}}, {{objetivo}}, {{oferta}}.
- instrucoes_background (string): instruções internas adicionais (curtas) para manter consistência.
- empresa_contexto (object): 6–12 chaves úteis (valores string), com dados do produto/empresa, ICP, objeções e regras.
- quem_fala_primeiro ("agente" ou "usuario").

Regras do roteiro:
- 1–2 frases por turno; tom humano, natural; sem falar que é IA.
- Não inventar dados; se faltar informação, pergunte.
- Se pedirem para não ligar mais: respeitar imediatamente e orientar proxima_acao = "nao_contatar".
- No máximo 2 perguntas de qualificação antes de propor o próximo passo.

Contexto do usuário:
empresa: ${body.empresa ?? ""}
produto: ${body.produto ?? ""}
público/ICP: ${body.publico ?? ""}
objetivo da ligação: ${body.objetivo ?? ""}
oferta/benefício: ${body.oferta ?? ""}
tom: ${body.tom ?? ""}
objeções comuns: ${body.objecoes ?? ""}
CTA desejado: ${body.cta ?? ""}
restrições legais/regras: ${body.restricoes ?? ""}
preferência de quem fala primeiro: ${body.quem_fala_primeiro ?? "auto"}
`.trim();

  let rawText: string;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return json({ error: "Erro na API Gemini.", detail: err }, 502);
    }

    const geminiJson = await geminiRes.json();
    rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) return json({ error: "Resposta vazia da API Gemini." }, 502);
  } catch (e) {
    return json({ error: "Falha ao contatar a API Gemini.", detail: String(e) }, 502);
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(rawText);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "JSON inválido.", raw: rawText.slice(0, 2000) }, 502);
  }

  const obj = toObj(parsed);
  return json({
    prompt_template: toStr(obj.prompt_template),
    instrucoes_background: toStr(obj.instrucoes_background),
    empresa_contexto: toObj(obj.empresa_contexto),
    quem_fala_primeiro: obj.quem_fala_primeiro === "usuario" ? "usuario" : "agente",
  });
});
