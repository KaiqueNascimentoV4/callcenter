/**
 * Reamostrador PCM16 por interpolação linear.
 * Suporta as conversões do pipeline:
 *   8 kHz  → 16 kHz  (Twilio → Gemini input)
 *   24 kHz → 8 kHz   (Gemini output → Twilio)
 *
 * @param {Buffer} pcmBuf  PCM16 little-endian
 * @param {number} fromRate taxa de origem em Hz
 * @param {number} toRate   taxa de destino em Hz
 * @returns {Buffer} PCM16 little-endian na nova taxa
 */
export function resamplePcm16(pcmBuf, fromRate, toRate) {
  if (fromRate === toRate) return pcmBuf;

  const inputSamples = pcmBuf.length >> 1;
  const outputSamples = Math.round(inputSamples * toRate / fromRate);
  const out = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcPos = i * fromRate / toRate;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;

    const s1 = pcmBuf.readInt16LE(Math.min(idx, inputSamples - 1) * 2);
    const s2 = pcmBuf.readInt16LE(Math.min(idx + 1, inputSamples - 1) * 2);

    const interpolated = Math.round(s1 + (s2 - s1) * frac);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
  }

  return out;
}
