// G.711 μ-law codec — Twilio sends/receives audio/x-mulaw 8kHz mono
const BIAS = 33;
const MAX = 32767;

function encodeSample(sample) {
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  if (sample > MAX) sample = MAX;
  sample += BIAS;

  let exp = 7;
  let mask = 0x4000;
  while ((sample & mask) === 0 && exp > 0) {
    exp--;
    mask >>= 1;
  }

  const mantissa = (sample >> (exp + 3)) & 0x0f;
  return (~(sign | (exp << 4) | mantissa)) & 0xff;
}

function decodeSample(byte) {
  byte = (~byte) & 0xff;
  const sign = byte & 0x80;
  const exp = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exp;
  sample -= BIAS;
  return sign ? -sample : sample;
}

/**
 * Converte buffer μ-law 8-bit para PCM16 little-endian.
 * @param {Buffer} mulawBuf
 * @returns {Buffer} PCM16 LE
 */
export function decodeMulawToPcm16(mulawBuf) {
  const pcm = Buffer.alloc(mulawBuf.length * 2);
  for (let i = 0; i < mulawBuf.length; i++) {
    const s = Math.max(-32768, Math.min(32767, decodeSample(mulawBuf[i])));
    pcm.writeInt16LE(s, i * 2);
  }
  return pcm;
}

/**
 * Converte buffer PCM16 little-endian para μ-law 8-bit.
 * @param {Buffer} pcmBuf PCM16 LE
 * @returns {Buffer}
 */
export function encodePcm16ToMulaw(pcmBuf) {
  const samples = pcmBuf.length >> 1;
  const mulaw = Buffer.alloc(samples);
  for (let i = 0; i < samples; i++) {
    mulaw[i] = encodeSample(pcmBuf.readInt16LE(i * 2));
  }
  return mulaw;
}
