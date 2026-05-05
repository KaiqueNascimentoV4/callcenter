import { GoogleGenAI, Modality } from "@google/genai";
import { salvarResultadoLigacaoDeclaration, salvarInformacaoClienteDeclaration } from "./tools.js";

let _ai;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

/**
 * Abre uma sessão Gemini Live para uma chamada.
 * @param {object} opts
 * @param {string}   opts.systemPrompt
 * @param {string}   opts.model
 * @param {string}   opts.voice
 * @param {number}   [opts.vadSilencioMs]          — ms de silêncio antes de cortar (padrão 800)
 * @param {string}   [opts.vadSensStart]            — START_SENSITIVITY_LOW/MEDIUM/HIGH
 * @param {string}   [opts.vadSensEnd]              — END_SENSITIVITY_LOW/MEDIUM/HIGH
 * @param {function} opts.onMessage
 * @param {function} [opts.onError]
 * @param {function} [opts.onClose]
 */
export async function createLiveSession({
  systemPrompt,
  model,
  voice,
  vadSilencioMs,
  vadSensStart,
  vadSensEnd,
  onMessage,
  onError,
  onClose,
}) {
  const ai = getAI();

  const session = await ai.live.connect({
    model: model ?? process.env.GEMINI_MODEL ?? "gemini-3.1-flash-live-preview",
    config: {
      responseModalities: [Modality.AUDIO],

      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice ?? process.env.GEMINI_VOICE ?? "Kore",
          },
        },
      },

      inputAudioTranscription: {},
      outputAudioTranscription: {},

      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: vadSensStart ?? "START_SENSITIVITY_LOW",
          endOfSpeechSensitivity: vadSensEnd ?? "END_SENSITIVITY_LOW",
          prefixPaddingMs: 200,
          silenceDurationMs: vadSilencioMs ?? 800,
        },
      },

      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },

      tools: [{
        functionDeclarations: [
          salvarResultadoLigacaoDeclaration,
          salvarInformacaoClienteDeclaration,
        ],
      }],
    },

    callbacks: {
      onmessage: onMessage,
      onerror: onError ?? ((e) => console.error("[Gemini] error", e)),
      onclose: onClose ?? ((e) => console.log("[Gemini] closed", e?.reason ?? "")),
    },
  });

  return session;
}
