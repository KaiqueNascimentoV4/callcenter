import "dotenv/config";
import "./ws-polyfill.js";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors"; // 👈 Biblioteca importada aqui
import { createServer } from "http";
import { WebSocketServer } from "ws";
import twilio from "twilio";

import { buildStreamTwiml } from "./twilio/twiml.js";
import { createCall } from "./twilio/createCall.js";
import { createLiveSession } from "./gemini/createLiveSession.js";
import { buildPromptForLead } from "./gemini/promptBuilder.js";
import { decodeMulawToPcm16, encodePcm16ToMulaw } from "./audio/mulaw.js";
import { resamplePcm16 } from "./audio/resample.js";
import {
  getLeadById, listLeads, upsertLead, updateLead, deleteLead,
  saveLeadInfoChave, getLeadInfoChave, bulkImportLeads,
} from "./db/leads.js";
import {
  saveCallResult,
  listCallResults,
  getCallResultById,
  getTranscriptsByCallSid,
  getTranscriptsConversation,
  getStatsSummary,
  getStatsByDate,
  getStatsByAgent,
} from "./db/callResults.js";
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  regenerateInboundToken,
  getEffectiveAgentConfig,
  getAgentByInboundToken,
} from "./db/agents.js";
import { debouncedAppendTranscript } from "./transcriptDebouncer.js";
import { findPhoneInJson, getJsonPath } from "./util/webhookInbound.js";
import { generateVoiceSamplePreview } from "./gemini/voicePreview.js";
import { listCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign, getCampaignStats } from "./db/campaigns.js";
import { getBotConfig, updateBotConfig } from "./db/botConfig.js";
import { supabase } from "./db/supabase.js";

const PORT = process.env.PORT ?? 3000;

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const app = express();

// ─── CORS (REST + preflight) ────────────────────────────────────────────────
// Útil se o frontend chamar a API por URL absoluta (outro subdomínio). Same-origin /api-ext na Vercel não precisa disto.
const CORS_ORIGINS = new Set([
  "https://call.v4companyamaral.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.has(origin)) return callback(null, true);
      if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) return callback(null, true);
      callback(null, true); // integrações / ferramentas; restringir se necessário
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    maxAge: 86400,
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── Twilio signature validation ────────────────────────────────────────────

function twilioMiddleware(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    req.headers["x-twilio-signature"],
    `${process.env.PUBLIC_BASE_URL}${req.originalUrl}`,
    req.body
  );
  if (!valid) return res.status(403).send("Forbidden");
  next();
}

// ─── Routes: TwiML / calls ───────────────────────────────────────────────────

app.post("/twiml/voice", twilioMiddleware, (req, res) => {
  const leadId = req.query.leadId ?? req.body.leadId;
  const campaignId = req.query.campaignId ?? req.body.campaignId;
  res.type("text/xml").send(buildStreamTwiml({ leadId, campaignId }));
});

app.post("/calls/start", async (req, res) => {
  const { leadId, campaignId } = req.body;
  if (!leadId) return res.status(400).json({ error: "leadId obrigatório" });

  const lead = await getLeadById(leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  if (lead.status === "nao_contatar") return res.status(400).json({ error: "Lead marcado como não contatar" });

  try {
    const call = await createCall({ to: lead.telefone, leadId, campaignId });
    res.json({ callSid: call.sid, status: call.status });
  } catch (err) {
    console.error("[/calls/start]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Routes: Leads ───────────────────────────────────────────────────────────

app.get("/leads", async (req, res) => {
  const { page, limit, status, campaign_id, agent_id, q } = req.query;
  const result = await listLeads({
    page: +page || 1,
    limit: +limit || 50,
    status,
    campaign_id,
    agent_id,
    q,
  });
  res.json(result);
});

app.post("/leads", async (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = randomUUID();
  const { nome, telefone } = body;
  if (!nome || !telefone) return res.status(400).json({ error: "nome e telefone são obrigatórios" });
  const lead = await upsertLead(body);
  res.json(lead);
});

app.get("/leads/:id", async (req, res) => {
  const lead = await getLeadById(req.params.id);
  if (!lead) return res.status(404).json({ error: "Não encontrado" });
  const info = await getLeadInfoChave(req.params.id);
  const { data: historico } = await listCallResults({ lead_id: req.params.id, limit: 10 });
  res.json({ ...lead, info_chave: info, historico_ligacoes: historico });
});

app.put("/leads/:id", async (req, res) => {
  const lead = await updateLead(req.params.id, req.body);
  res.json(lead);
});

app.delete("/leads/:id", async (req, res) => {
  await deleteLead(req.params.id);
  res.json({ ok: true });
});

app.post("/leads/:id/info", async (req, res) => {
  const { chave, valor } = req.body;
  if (!chave || !valor) return res.status(400).json({ error: "chave e valor são obrigatórios" });
  await saveLeadInfoChave(req.params.id, chave, valor);
  res.json({ ok: true });
});

app.post("/leads/import", async (req, res) => {
  const { leads } = req.body;
  if (!Array.isArray(leads)) return res.status(400).json({ error: "leads deve ser um array" });
  const data = await bulkImportLeads(leads);
  res.json({ imported: data.length });
});

// ─── Routes: Results / Transcripts ───────────────────────────────────────────

app.get("/results", async (req, res) => {
  const { page, limit, lead_id, agent_id, interesse, humor, proxima_acao, from, to } = req.query;
  const result = await listCallResults({
    page: +page || 1,
    limit: +limit || 50,
    lead_id,
    agent_id,
    interesse,
    humor,
    proxima_acao,
    from,
    to,
  });
  res.json(result);
});

app.get("/results/:id", async (req, res) => {
  const result = await getCallResultById(req.params.id);
  if (!result) return res.status(404).json({ error: "Não encontrado" });
  res.json(result);
});

app.get("/transcripts/:callSid", async (req, res) => {
  const data = await getTranscriptsByCallSid(req.params.callSid);
  res.json(data);
});

app.get("/transcripts/:callSid/conversation", async (req, res) => {
  const data = await getTranscriptsConversation(req.params.callSid);
  res.json(data);
});

// ─── Routes: Campaigns ───────────────────────────────────────────────────────

app.get("/campaigns", async (_req, res) => {
  res.json(await listCampaigns());
});

app.post("/campaigns", async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: "nome é obrigatório" });
  res.json(await createCampaign(req.body));
});

app.get("/campaigns/:id", async (req, res) => {
  const data = await getCampaignById(req.params.id);
  if (!data) return res.status(404).json({ error: "Não encontrado" });
  res.json(data);
});

app.put("/campaigns/:id", async (req, res) => {
  res.json(await updateCampaign(req.params.id, req.body));
});

app.delete("/campaigns/:id", async (req, res) => {
  await deleteCampaign(req.params.id);
  res.json({ ok: true });
});

app.get("/campaigns/:id/stats", async (req, res) => {
  res.json(await getCampaignStats(req.params.id));
});

app.post("/campaigns/:id/dispatch", async (req, res) => {
  const campaign = await getCampaignById(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

  const leads = campaign.leads?.filter(l => l.status === "novo" || l.status === "contactado") ?? [];
  const results = [];

  for (const lead of leads) {
    try {
      const call = await createCall({ to: lead.telefone, leadId: lead.id, campaignId: campaign.id });
      results.push({ leadId: lead.id, callSid: call.sid, ok: true });
    } catch (e) {
      results.push({ leadId: lead.id, ok: false, error: e.message });
    }
    // Delay entre ligações para não sobrecarregar
    await new Promise(r => setTimeout(r, 2000));
  }

  res.json({ dispatched: results.length, results });
});

// ─── Routes: Agents ───────────────────────────────────────────────────────────

app.get("/agents", async (req, res) => {
  const all = req.query.include_inactive === "true";
  res.json(await listAgents({ includeInactive: all }));
});

app.get("/agents/:id/voice-preview", async (req, res) => {
  const agent = await getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agente não encontrado" });
  const merged = await getEffectiveAgentConfig(agent);
  const sample = await generateVoiceSamplePreview({
    voice: merged.voz,
    agentName: agent.nome,
    empresaNome: agent.empresa_nome,
  });
  if (!sample?.base64) {
    return res.status(503).json({
      error:
        "Preview de voz indisponível. Verifique GEMINI_API_KEY e o modelo; tente gemini-2.0-flash no agente.",
    });
  }
  const buf = Buffer.from(sample.base64, "base64");
  const ct = sample.mimeType?.split(";")[0]?.trim() || "audio/L16";
  res.setHeader("Content-Type", ct);
  res.send(buf);
});

app.get("/agents/:id", async (req, res) => {
  const row = await getAgentById(req.params.id);
  if (!row) return res.status(404).json({ error: "Não encontrado" });
  res.json(row);
});

app.post("/agents", async (req, res) => {
  try {
    res.json(await createAgent(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/agents/:id", async (req, res) => {
  try {
    res.json(await updateAgent(req.params.id, req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/agents/:id", async (req, res) => {
  await deleteAgent(req.params.id);
  res.json({ ok: true });
});

app.post("/agents/:id/regenerate-token", async (req, res) => {
  res.json(await regenerateInboundToken(req.params.id));
});

// ─── Webhook entrada (JSON livre → lead + ligação) ────────────────────────────

app.post("/hooks/inbound/:token", async (req, res) => {
  const agent = await getAgentByInboundToken(req.params.token);
  if (!agent?.ativo) return res.status(404).json({ error: "Token inválido" });

  const raw = req.body;
  let phone =
    (agent.telefone_json_path && getJsonPath(raw, agent.telefone_json_path)) || null;
  if (typeof phone !== "string") phone = findPhoneInJson(raw);

  if (!phone) {
    return res.status(400).json({
      error:
        "Telefone E.164 não encontrado. Configure telefone_json_path no agente (ex.: $.telefone) ou inclua +55... no JSON.",
    });
  }

  const nomeGuess =
    getJsonPath(raw, "$.nome") ??
    getJsonPath(raw, "nome") ??
    getJsonPath(raw, "$.name") ??
    "Lead";

  const lead = await upsertLead({
    id: randomUUID(),
    nome: String(nomeGuess),
    telefone: phone,
    agent_id: agent.id,
    payload_extras: typeof raw === "object" && raw !== null ? raw : { payload: raw },
    status: "novo",
    tentativas: 0,
  });

  try {
    const call = await createCall({ to: lead.telefone, leadId: lead.id });
    res.json({ ok: true, leadId: lead.id, callSid: call.sid, status: call.status });
  } catch (err) {
    console.error("[hooks/inbound]", err);
    res.status(500).json({ error: err.message, leadId: lead.id });
  }
});

// ─── Routes: Bot Config ──────────────────────────────────────────────────────

app.get("/bot-config", async (_req, res) => {
  res.json(await getBotConfig());
});

app.put("/bot-config", async (req, res) => {
  res.json(await updateBotConfig(req.body));
});

// ─── Routes: Stats ───────────────────────────────────────────────────────────

app.get("/stats/summary", async (req, res) => {
  res.json(await getStatsSummary({ agent_id: req.query.agent_id }));
});

app.get("/stats/by-date", async (req, res) => {
  res.json(
    await getStatsByDate({
      from: req.query.from,
      to: req.query.to,
      agent_id: req.query.agent_id,
    })
  );
});

app.get("/stats/by-agent", async (req, res) => {
  res.json(await getStatsByAgent({ from: req.query.from, to: req.query.to }));
});

// ─── Routes: Admin (user approvals) ──────────────────────────────────────────

app.get("/admin/users", async (req, res) => {
  const { data, error } = await supabase
    .from("user_approvals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch("/admin/users/:userId", async (req, res) => {
  const { approved, admin } = req.body;
  const fields = {};
  if (typeof approved === "boolean") {
    fields.approved = approved;
    fields.approved_at = approved ? new Date().toISOString() : null;
  }
  if (typeof admin === "boolean") fields.admin = admin;
  const { data, error } = await supabase
    .from("user_approvals")
    .update(fields)
    .eq("user_id", req.params.userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── WebSocket /media ────────────────────────────────────────────────────────

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/media" });

wss.on("connection", (twilioWs) => {
  console.log("[WS] Nova conexão Twilio");

  let streamSid = null;
  let callSid = null;
  let leadId = null;
  let wsAgentId = null;
  let webhookSaidaUrl = null;
  let geminiSession = null;
  let botConfig = null;

  const audioQueue = [];
  let sending = false;

  function flushQueue() {
    if (sending || audioQueue.length === 0) return;
    sending = true;
    const payload = audioQueue.shift();
    try {
      if (twilioWs.readyState === twilioWs.OPEN) {
        twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload } }));
      }
    } catch (e) {
      console.error("[WS] Erro ao enviar áudio", e);
    }
    sending = false;
    if (audioQueue.length > 0) setImmediate(flushQueue);
  }

  function enqueueAudio(mulawBase64) {
    audioQueue.push(mulawBase64);
    flushQueue();
  }

  function sendClear() {
    if (twilioWs.readyState !== twilioWs.OPEN) return;
    twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
    audioQueue.length = 0;
  }

  async function handleGeminiMessage(geminiMsg) {
    try {
      await handleGeminiMessageInner(geminiMsg);
    } catch (e) {
      console.error("[Gemini] handleGeminiMessage", e);
    }
  }

  async function handleGeminiMessageInner(geminiMsg) {
    if (geminiMsg.serverContent?.modelTurn?.parts) {
      for (const part of geminiMsg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const pcm24k = Buffer.from(part.inlineData.data, "base64");
          const pcm8k = resamplePcm16(pcm24k, 24000, 8000);
          enqueueAudio(encodePcm16ToMulaw(pcm8k).toString("base64"));
        }
      }
    }

    if (geminiMsg.serverContent?.interrupted) {
      sendClear();
    }

    const inputText = geminiMsg.serverContent?.inputTranscription?.text;
    if (inputText) {
      console.log(`[Trans] Usuário: ${inputText}`);
      debouncedAppendTranscript(callSid, "user", inputText);
    }

    const outputText = geminiMsg.serverContent?.outputTranscription?.text;
    if (outputText) {
      console.log(`[Trans] Agente: ${outputText}`);
      debouncedAppendTranscript(callSid, "agent", outputText);
    }

    if (geminiMsg.toolCall?.functionCalls) {
      for (const fc of geminiMsg.toolCall.functionCalls) {
        if (fc.name === "salvar_resultado_ligacao") {
          console.log("[FC] salvar_resultado_ligacao", fc.args);
          try {
            await saveCallResult({
              callSid,
              leadId,
              agentId: wsAgentId,
              ...fc.args,
            });
          } catch (err) {
            console.error("[FC] Erro ao salvar resultado", err);
          }

          const webhookPayload = { callSid, leadId, agentId: wsAgentId, ...fc.args };

          if (process.env.N8N_WEBHOOK_URL) {
            fetch(process.env.N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(webhookPayload),
            }).catch((e) => console.error("[n8n]", e));
          }

          if (webhookSaidaUrl) {
            fetch(webhookSaidaUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(webhookPayload),
            }).catch((e) => console.error("[webhook agente]", e));
          }

          geminiSession?.sendToolResponse({
            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok", saved: true } }],
          });
        }

        if (fc.name === "salvar_informacao_cliente") {
          console.log("[FC] salvar_informacao_cliente", fc.args);
          if (leadId) {
            saveLeadInfoChave(leadId, fc.args.chave, fc.args.valor).catch(console.error);
          }
          geminiSession?.sendToolResponse({
            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }],
          });
        }
      }
    }
  }

  twilioWs.on("message", async (raw) => {
    let msg;
    try {
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.event) {
      case "connected":
        console.log("[WS] connected");
        break;

      case "start": {
        try {
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          leadId = msg.start.customParameters?.leadId;
          wsAgentId = null;
          webhookSaidaUrl = null;
          console.log(`[WS] start — callSid=${callSid} leadId=${leadId}`);

          const lead = leadId ? await getLeadById(leadId) : null;
          wsAgentId = lead?.agent_id ?? null;
          const agentRow = wsAgentId ? await getAgentById(wsAgentId) : null;
          webhookSaidaUrl = agentRow?.webhook_saida_url ?? null;

          botConfig = await getEffectiveAgentConfig(agentRow);

          const systemPrompt = buildPromptForLead(lead ?? { nome: "cliente" }, botConfig);

          try {
            geminiSession = await createLiveSession({
              systemPrompt,
              model: botConfig.modelo_gemini,
              voice: botConfig.voz,
              onMessage: handleGeminiMessage,
              onError: (e) => console.error("[Gemini] error", e),
              onClose: (e) => console.log("[Gemini] closed", e?.reason ?? ""),
            });
            console.log("[Gemini] Sessão aberta");

            if (botConfig.quem_fala_primeiro === "agente") {
              setTimeout(() => {
                try {
                  geminiSession?.sendClientContent({
                    turns: [{ role: "user", parts: [{ text: "A chamada foi atendida. Inicie a conversa agora." }] }],
                    turnComplete: true,
                  });
                } catch (e) {
                  console.error("[WS] sendClientContent", e);
                }
              }, 500);
            }

            const timeout = (botConfig.timeout_segundos ?? 120) * 1000;
            setTimeout(() => {
              try {
                if (geminiSession) {
                  console.log(`[WS] Timeout de ${botConfig.timeout_segundos}s atingido`);
                  geminiSession.close();
                }
              } catch (e) {
                console.error("[WS] timeout close", e);
              }
            }, timeout);
          } catch (err) {
            console.error("[Gemini] Falha ao abrir sessão", err);
          }
        } catch (err) {
          console.error("[WS] Erro no evento start (lead/agent/prompt)", err);
        }
        break;
      }

      case "media": {
        if (!geminiSession) break;
        const mulaw8k = Buffer.from(msg.media.payload, "base64");
        const pcm16 = decodeMulawToPcm16(mulaw8k);
        const pcm16k = resamplePcm16(pcm16, 8000, 16000);
        geminiSession.sendRealtimeInput({
          audio: { data: pcm16k.toString("base64"), mimeType: "audio/pcm;rate=16000" },
        });
        break;
      }

      case "mark":
        console.log(`[WS] mark: ${msg.mark?.name}`);
        break;

      case "stop":
        console.log("[WS] stop");
        geminiSession?.close();
        geminiSession = null;
        break;
      }
    } catch (err) {
      console.error("[WS] Erro ao processar mensagem", err);
    }
  });

  twilioWs.on("close", () => {
    console.log("[WS] Conexão encerrada");
    geminiSession?.close();
    geminiSession = null;
  });

  twilioWs.on("error", (err) => console.error("[WS] Erro:", err));
});

// ─── Start ───────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n🎙  Voice Agent rodando na porta ${PORT}`);
  console.log(`   API: ${process.env.PUBLIC_BASE_URL}`);
  console.log(`   WSS: ${process.env.WS_PUBLIC_URL}\n`);
});