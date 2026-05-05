import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateAgentScriptInput = {
  empresa?: string;
  produto?: string;
  publico?: string;
  objetivo?: string;
  oferta?: string;
  tom?: "consultivo" | "direto" | "neutro";
  objecoes?: string;
  cta?: "whatsapp" | "reuniao" | "email" | "outro";
  restricoes?: string;
  quem_fala_primeiro?: "agente" | "usuario" | "auto";
};

function stripJsonFences(text: string) {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
  }
  return t;
}

function safeJsonParse(text: string) {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // tentativa: achar primeiro objeto JSON
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Resposta da IA não está em JSON válido.");
  }
}

function toStringOrEmpty(v: unknown) {
  return typeof v === "string" ? v : "";
}

function ensureObject(v: unknown) {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no ambiente do frontend." },
      { status: 500 },
    );
  }

  let body: GenerateAgentScriptInput;
  try {
    body = (await req.json()) as GenerateAgentScriptInput;
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)." }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Você é um especialista em roteiros de atendimento por voz (SDR/qualificação) em PT-BR.
Gere um JSON ESTRITO (sem markdown) com as chaves:
- prompt_template (string): roteiro principal com placeholders {{nome}}, {{empresa}}, {{cargo}}, {{origem}}, {{objetivo}}, {{oferta}}.
- instrucoes_background (string): instruções internas adicionais (curtas) para manter consistência.
- empresa_contexto (object): 6–12 chaves úteis (valores string), com dados do produto/empresa, ICP, objeções e regras.
- quem_fala_primeiro (\"agente\" ou \"usuario\").

Regras do roteiro:
- 1–2 frases por turno; tom humano, natural; sem falar que é IA.
- Não inventar dados; se faltar informação, pergunte.
- Se pedirem para não ligar mais: respeitar imediatamente e orientar proxima_acao = \"nao_contatar\".
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

  let text: string;
  try {
    const resp = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });
    text = resp.text ?? resp.candidates?.[0]?.content?.parts?.map((p) => ("text" in p ? String(p.text) : "")).join("\n") ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao gerar script com IA.", detail: String(e) },
      { status: 502 },
    );
  }

  let out: unknown;
  try {
    out = safeJsonParse(text);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Resposta inválida da IA.", raw: text.slice(0, 5000) },
      { status: 502 },
    );
  }

  const obj = ensureObject(out);
  const empresa_contexto = ensureObject(obj.empresa_contexto);

  const quem =
    obj.quem_fala_primeiro === "usuario" ? "usuario" : "agente";

  return NextResponse.json({
    prompt_template: toStringOrEmpty(obj.prompt_template),
    instrucoes_background: toStringOrEmpty(obj.instrucoes_background),
    empresa_contexto,
    quem_fala_primeiro: quem,
  });
}

