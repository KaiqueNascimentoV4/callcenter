1. Primeiro ajuste: não é “sem conversão”, é “sem STT/TTS externo”

A arquitetura continua sendo áudio nativo no Gemini, mas existe conversão de codec entre telefone e Gemini:

Twilio → servidor: audio/x-mulaw, 8 kHz, mono, base64.
Servidor → Gemini: PCM bruto, 16-bit, little-endian, idealmente 16 kHz.
Gemini → servidor: áudio PCM bruto, saída em 24 kHz.
Servidor → Twilio: precisa voltar para audio/x-mulaw, 8 kHz, base64.

A Twilio documenta que o Media Stream envia áudio audio/x-mulaw a 8000 Hz e 1 canal, e que o áudio enviado de volta para a chamada também precisa ser audio/x-mulaw/8000 em base64, sem header de arquivo. A Gemini Live API trabalha com áudio PCM bruto 16-bit little-endian; a entrada é nativamente 16 kHz, embora a API possa fazer resampling quando você informa o sample rate no MIME type, e a saída de áudio é 24 kHz.

Então o “cano” real fica assim:

Stakeholder no telefone
        ↓
Twilio Media Streams
        ↓  μ-law 8k base64
Servidor de ponte
        ↓  PCM16 16k base64
Gemini 3.1 Flash Live
        ↓  PCM16 24k base64
Servidor de ponte
        ↓  μ-law 8k base64
Twilio toca a resposta na ligação
2. Use este modelo e esta API

O modelo atual que corresponde ao que você descreveu é:

gemini-3.1-flash-live-preview

A página do modelo confirma que ele é otimizado para diálogo em tempo real áudio-para-áudio, suporta Live API, entrada de texto/imagem/áudio/vídeo, saída em texto e áudio, e function calling.

Como o seu caso é ligação telefônica, eu faria servidor Node.js primeiro, porque Twilio + WebSocket + streaming de buffers fica bem direto. Python também serve, mas Node costuma encaixar melhor com ws, Twilio SDK e filas de áudio.

3. Crie 3 endpoints no seu servidor

Você precisa de um backend público HTTPS/WSS:

POST /calls/start        → cria ligação outbound via Twilio
POST /twiml/voice        → Twilio busca o TwiML da chamada
WS   /media              → Twilio abre WebSocket de áudio

O /twiml/voice deve devolver algo assim:

<Response>
  <Connect>
    <Stream url="wss://api.suaempresa.com/media">
      <Parameter name="leadId" value="12345" />
      <Parameter name="campaignId" value="camp_001" />
    </Stream>
  </Connect>
</Response>

Use <Connect><Stream>, não <Start><Stream>, porque você precisa de áudio bidirecional: receber a fala da pessoa e mandar a resposta do Gemini de volta para a chamada. A Twilio diferencia isso claramente: <Start><Stream> cria stream unidirecional; <Connect><Stream> cria stream bidirecional.

Outro detalhe importante: a Twilio não aceita query string no atributo url do <Stream>; passe leadId, campaignId e outros metadados via <Parameter>.

4. No evento start da Twilio, abra a sessão Gemini

Quando a Twilio conectar no seu WebSocket /media, ela manda eventos como:

{ "event": "connected" }

Depois manda:

{
  "event": "start",
  "start": {
    "streamSid": "...",
    "callSid": "...",
    "customParameters": {
      "leadId": "12345"
    },
    "mediaFormat": {
      "encoding": "audio/x-mulaw",
      "sampleRate": 8000,
      "channels": 1
    }
  }
}

A mensagem start contém streamSid, callSid, customParameters e o formato do áudio. Nesse momento você busca o lead no banco e monta o prompt.

Exemplo de system instruction:

Você é um agente de voz da Empresa X.

Você está falando com:
- Nome: João Silva
- Empresa: TechCorp
- Cargo: Diretor Comercial
- Contexto: Demonstrou interesse em automação de atendimento.
- Objetivo da ligação: confirmar se ele aceita receber uma proposta por WhatsApp/e-mail.

Regras:
1. Fale sempre em português brasileiro.
2. Seja breve, natural e educado.
3. Confirme se está falando com João.
4. Não invente informações.
5. Se a pessoa pedir para parar, peça desculpas, confirme e encerre.
6. Ao final, chame a função salvar_resultado_ligacao.
5. Configure o Gemini Live com áudio + tools

No setup da sessão, configure:

const config = {
  responseModalities: [Modality.AUDIO],

  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Kore"
      }
    }
  },

  thinkingConfig: {
    thinkingLevel: "minimal"
  },

  inputAudioTranscription: {},
  outputAudioTranscription: {},

  systemInstruction: {
    parts: [{ text: systemPrompt }]
  },

  tools: [{
    functionDeclarations: [{
      name: "salvar_resultado_ligacao",
      description: "Salva o resultado final da ligação no CRM.",
      parameters: {
        type: "object",
        properties: {
          confirmado: { type: "boolean" },
          pessoa_correta: { type: "boolean" },
          interesse: {
            type: "string",
            enum: ["alto", "medio", "baixo", "sem_interesse", "incerto"]
          },
          humor: {
            type: "string",
            enum: ["positivo", "neutro", "negativo", "irritado", "incerto"]
          },
          resumo: { type: "string" },
          proxima_acao: {
            type: "string",
            enum: ["enviar_whatsapp", "enviar_email", "agendar_reuniao", "nao_contatar", "revisar_manualmente"]
          }
        },
        required: ["confirmado", "pessoa_correta", "interesse", "humor", "resumo", "proxima_acao"]
      }
    }]
  }]
};

A Live API permite configurar systemInstruction, ferramentas e geração na sessão inicial, mas essa configuração não é atualizada enquanto a conexão está aberta. Para Gemini 3.1 Flash Live, use thinkingLevel; o padrão é otimizado para baixa latência, e o próprio Google recomenda atenção porque eventos do servidor podem trazer múltiplas partes no mesmo evento.

Eu ativaria inputAudioTranscription e outputAudioTranscription no MVP para auditoria e debug. A própria Live API permite transcrição tanto da entrada de voz quanto da saída de áudio do modelo.

6. Faça a ponte de áudio

No servidor, você terá dois loops:

Loop A — Twilio → Gemini

Quando chegar:

{
  "event": "media",
  "media": {
    "payload": "base64..."
  }
}

Você faz:

base64 decode
→ μ-law 8k decode
→ PCM16
→ opcional: resample 8k para 16k
→ envia para Gemini como audio/pcm;rate=16000

Payload para Gemini:

session.sendRealtimeInput({
  audio: {
    data: pcm16Base64,
    mimeType: "audio/pcm;rate=16000"
  }
});

A documentação da Gemini mostra o envio de áudio via sendRealtimeInput com audio.data em base64 e mimeType: "audio/pcm;rate=16000".

Loop B — Gemini → Twilio

Quando Gemini devolver áudio:

PCM16 24k base64
→ base64 decode
→ resample 24k para 8k
→ encode μ-law
→ base64
→ envia para Twilio como media.payload

Mensagem para Twilio:

twilioWs.send(JSON.stringify({
  event: "media",
  streamSid,
  media: {
    payload: mulaw8kBase64
  }
}));

A Twilio exige exatamente esse formato para enviar áudio de volta na chamada: evento media, streamSid e media.payload com áudio mulaw/8000 em base64.

Também envie mark depois dos blocos de áudio relevantes para saber quando a Twilio terminou de tocar uma resposta. A Twilio recomenda usar mark após media para receber confirmação quando o áudio foi reproduzido.

7. Trate o function calling como evento de negócio

Quando o Gemini chamar:

{
  "toolCall": {
    "functionCalls": [
      {
        "id": "...",
        "name": "salvar_resultado_ligacao",
        "args": {
          "confirmado": true,
          "pessoa_correta": true,
          "interesse": "medio",
          "humor": "positivo",
          "resumo": "João confirmou interesse e aceitou receber proposta por WhatsApp.",
          "proxima_acao": "enviar_whatsapp"
        }
      }
    ]
  }
}

Seu servidor:

1. valida os campos
2. salva no banco/CRM
3. dispara webhook para n8n, se necessário
4. responde ao Gemini com toolResponse
5. encerra ou deixa o Gemini se despedir

Importante: na Live API, function calling não é automático; seu cliente precisa executar a função e mandar a resposta manualmente. Em Gemini 3.1 Flash Live, function calling é suportado, mas síncrono.

Exemplo de resposta:

session.sendToolResponse({
  functionResponses: [{
    id: fc.id,
    name: fc.name,
    response: {
      result: "ok",
      saved: true
    }
  }]
});
Estrutura mínima do projeto
voice-agent/
  src/
    server.js
    twilio/
      createCall.js
      twiml.js
    gemini/
      createLiveSession.js
      promptBuilder.js
      tools.js
    audio/
      mulaw.js
      resample.js
    db/
      leads.js
      callResults.js
  .env

.env:

PORT=3000
PUBLIC_BASE_URL=https://api.suaempresa.com
WS_PUBLIC_URL=wss://api.suaempresa.com/media

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+55...

GEMINI_API_KEY=...
DATABASE_URL=...
N8N_WEBHOOK_URL=...
Pseudocódigo do servidor
import express from "express";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";
import twilio from "twilio";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/twiml/voice", async (req, res) => {
  const leadId = req.query.leadId || req.body.leadId;

  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();

  const stream = connect.stream({
    url: process.env.WS_PUBLIC_URL
  });

  stream.parameter({ name: "leadId", value: leadId });

  res.type("text/xml").send(response.toString());
});

const server = app.listen(process.env.PORT || 3000);
const wss = new WebSocketServer({ server, path: "/media" });

wss.on("connection", (twilioWs, req) => {
  let streamSid = null;
  let callSid = null;
  let geminiSession = null;

  twilioWs.on("message", async raw => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      callSid = msg.start.callSid;

      const leadId = msg.start.customParameters?.leadId;
      const lead = await getLeadFromDb(leadId);

      const systemPrompt = buildPromptForLead(lead);

      geminiSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          thinkingConfig: { thinkingLevel: "minimal" },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          tools: [{
            functionDeclarations: [salvarResultadoLigacaoDeclaration]
          }]
        },
        callbacks: {
          onmessage: async geminiMsg => {
            await handleGeminiMessage({
              geminiMsg,
              twilioWs,
              streamSid,
              callSid
            });
          },
          onerror: e => console.error("Gemini error", e),
          onclose: e => console.log("Gemini closed", e?.reason)
        }
      });

      return;
    }

    if (msg.event === "media" && geminiSession) {
      const mulaw8k = Buffer.from(msg.media.payload, "base64");

      const pcm16 = decodeMulawToPcm16(mulaw8k);
      const pcm16_16k = resamplePcm16(pcm16, 8000, 16000);

      geminiSession.sendRealtimeInput({
        audio: {
          data: pcm16_16k.toString("base64"),
          mimeType: "audio/pcm;rate=16000"
        }
      });

      return;
    }

    if (msg.event === "stop") {
      geminiSession?.close();
    }
  });

  twilioWs.on("close", () => {
    geminiSession?.close();
  });
});

async function handleGeminiMessage({ geminiMsg, twilioWs, streamSid, callSid }) {
  if (geminiMsg.serverContent?.modelTurn?.parts) {
    for (const part of geminiMsg.serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        const pcm24k = Buffer.from(part.inlineData.data, "base64");
        const pcm8k = resamplePcm16(pcm24k, 24000, 8000);
        const mulaw8k = encodePcm16ToMulaw(pcm8k);

        twilioWs.send(JSON.stringify({
          event: "media",
          streamSid,
          media: {
            payload: mulaw8k.toString("base64")
          }
        }));
      }
    }
  }

  if (geminiMsg.serverContent?.inputTranscription) {
    await appendTranscript(callSid, "user", geminiMsg.serverContent.inputTranscription.text);
  }

  if (geminiMsg.serverContent?.outputTranscription) {
    await appendTranscript(callSid, "agent", geminiMsg.serverContent.outputTranscription.text);
  }

  if (geminiMsg.toolCall?.functionCalls) {
    for (const fc of geminiMsg.toolCall.functionCalls) {
      if (fc.name === "salvar_resultado_ligacao") {
        await saveCallResult({
          callSid,
          ...fc.args
        });

        await sendGeminiToolResponse(fc.id, fc.name, {
          result: "ok",
          saved: true
        });
      }
    }
  }
}

Esse código ainda está em nível de esqueleto. As partes críticas que precisam ser implementadas com cuidado são decodeMulawToPcm16, encodePcm16ToMulaw e resamplePcm16.

O que eu faria na prática, em ordem
Dia 1 — Prova de vida

Subir um servidor Node com:

/twiml/voice
/media

Testar com ngrok ou domínio público WSS. A Twilio exige WebSocket seguro wss para o <Stream>.

Meta do dia:

Ligação conecta → Twilio abre WS → servidor loga connected/start/media
Dia 2 — Gemini falando sozinho

Abrir sessão Gemini Live dentro do servidor, sem Twilio ainda.

Meta:

Servidor manda texto/áudio teste → Gemini responde áudio → salvar .pcm/.wav local
Dia 3 — Twilio → Gemini

Pegar áudio real da ligação, converter μ-law para PCM16 e enviar para Gemini.

Meta:

Pessoa fala no telefone → Gemini entende → logs mostram input transcription
Dia 4 — Gemini → Twilio

Converter saída PCM 24 kHz do Gemini para μ-law 8 kHz e tocar na ligação.

Meta:

Pessoa fala → Gemini responde → pessoa escuta no telefone
Dia 5 — Function calling + CRM/n8n

Implementar salvar_resultado_ligacao.

Contrato recomendado:

{
  "callSid": "CA...",
  "leadId": "12345",
  "confirmado": true,
  "pessoa_correta": true,
  "interesse": "medio",
  "humor": "positivo",
  "resumo": "Aceitou receber proposta.",
  "proxima_acao": "enviar_whatsapp",
  "transcricao_usuario": "...",
  "transcricao_agente": "...",
  "createdAt": "..."
}
Dia 6 — Interrupção e latência

Implementar:

- clear no Twilio quando usuário interrompe
- VAD / barge-in
- fila de áudio de saída
- cancelamento de resposta atual
- logs de latência por trecho

A Twilio permite enviar clear para limpar o áudio bufferizado e interromper playback.

Dia 7 — Segurança e produção

Obrigatório antes de rodar com leads reais:

- validar X-Twilio-Signature
- não expor GEMINI_API_KEY no front
- logs sem dados sensíveis desnecessários
- consentimento/LGPD
- opt-out: “não me ligue mais”
- retry seguro
- fallback humano
- timeout de ligação

A Twilio recomenda validar o header X-Twilio-Signature para confirmar que o Media Stream veio da própria Twilio. A Live API também é server-to-server por padrão; para cliente direto seria necessário usar tokens efêmeros, mas no seu desenho o correto é manter a chave Gemini só no servidor.

Prompt final que eu usaria no MVP
Você é um agente de voz da [EMPRESA].

Contexto da ligação:
- Nome do contato: {{nome}}
- Empresa: {{empresa}}
- Cargo: {{cargo}}
- Origem do lead: {{origem}}
- Objetivo: {{objetivo}}
- Produto/oferta: {{oferta}}

Sua missão:
1. Cumprimente de forma breve.
2. Confirme se está falando com {{nome}}.
3. Explique em uma frase o motivo da ligação.
4. Faça no máximo 2 perguntas.
5. Se houver interesse, confirme o melhor próximo passo.
6. Se não houver interesse, respeite imediatamente.
7. Ao encerrar, chame a função salvar_resultado_ligacao.

Estilo:
- Português brasileiro.
- Natural, humano e direto.
- Frases curtas.
- Não fale como robô.
- Não mencione que está seguindo um script.
- Nunca invente dados.
- Não pressione a pessoa.
- Se a pessoa pedir para não ligar mais, classifique proxima_acao como "nao_contatar".

Quando chamar salvar_resultado_ligacao:
- Depois de confirmar o resultado da conversa.
- Antes de encerrar completamente a sessão.
- Inclua resumo curto e objetivo.
Checklist técnico final
[ ] Conta Twilio com número habilitado para Voice
[ ] Endpoint POST /twiml/voice retornando <Connect><Stream>
[ ] Endpoint WS /media público via wss
[ ] Validação X-Twilio-Signature
[ ] Parser dos eventos connected/start/media/mark/stop
[ ] Gemini Live session por chamada
[ ] Prompt populado pelo leadId
[ ] Function declaration salvar_resultado_ligacao
[ ] Conversão μ-law 8k → PCM16 16k
[ ] Conversão PCM16 24k → μ-law 8k
[ ] Fila de áudio de saída
[ ] Clear/barge-in
[ ] Transcrição opcional para auditoria
[ ] Persistência no banco
[ ] Webhook n8n/CRM
[ ] Encerramento limpo da chamada
[ ] Logs de latência e erros