import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Amostra curta de áudio com a voz prebuilt do Gemini (modelo não-live).
 * Pode falhar conforme modelo/região — nesse caso retorna null.
 */
export async function generateVoiceSamplePreview({ voice, model }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const previewModel =
    model && !String(model).includes("live") ? model : "gemini-2.0-flash";

  try {
    const response = await ai.models.generateContent({
      model: previewModel,
      contents:
        "Fale exatamente esta frase em português do Brasil, com tom profissional e breve: Olá, sou o assistente virtual.",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || "Kore",
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find(
      (p) => p.inlineData?.mimeType?.startsWith("audio/") || p.inlineData?.data
    );
    if (audioPart?.inlineData?.data) {
      return {
        mimeType: audioPart.inlineData.mimeType || "audio/L16;codec=pcm;rate=24000",
        base64: audioPart.inlineData.data,
      };
    }
  } catch (e) {
    console.error("[voicePreview]", e.message);
  }
  return null;
}
