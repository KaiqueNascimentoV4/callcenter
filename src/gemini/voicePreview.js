import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Amostra curta de áudio com a voz prebuilt do Gemini TTS.
 * Usa gemini-2.5-flash-preview-tts (modelo dedicado de TTS).
 * Fallback para gemini-2.0-flash caso o modelo TTS falhe (ex: região).
 */
export async function generateVoiceSamplePreview({ voice, agentName, empresaNome }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const saudacao = agentName
    ? `Olá! Sou ${agentName}${empresaNome ? `, da ${empresaNome}` : ""}. Como posso te ajudar hoje?`
    : "Olá! Sou o assistente virtual. Como posso te ajudar hoje?";

  const voiceName = voice || "Kore";

  const tryModel = async (model) => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: saudacao }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
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
          mimeType: audioPart.inlineData.mimeType || "audio/wav",
          base64: audioPart.inlineData.data,
        };
      }
    } catch (e) {
      console.warn(`[voicePreview] ${model} falhou:`, e.message);
    }
    return null;
  };

  return (
    (await tryModel("gemini-2.5-flash-preview-tts")) ??
    (await tryModel("gemini-2.0-flash"))
  );
}
