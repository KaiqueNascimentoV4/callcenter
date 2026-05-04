import { appendTranscript } from "./db/callResults.js";

const buffers = new Map();

function bufKey(callSid, role) {
  return `${callSid}\0${role}`;
}

/**
 * Acumula chunks STT e faz um único insert após silêncio (menos linhas na BD).
 */
export function debouncedAppendTranscript(callSid, role, texto, ms = 480) {
  if (!callSid || !texto?.trim()) return;
  const k = bufKey(callSid, role);
  let b = buffers.get(k);
  if (!b) {
    b = { parts: [], timer: null };
    buffers.set(k, b);
  }
  b.parts.push(texto.trim());

  clearTimeout(b.timer);
  b.timer = setTimeout(async () => {
    const merged = b.parts.join(" ");
    buffers.delete(k);
    await appendTranscript(callSid, role, merged);
  }, ms);
}

export async function flushAllTranscripts() {
  for (const [k, b] of buffers.entries()) {
    clearTimeout(b.timer);
    const [sid, role] = k.split("\0");
    const merged = b.parts.join(" ");
    if (merged.trim()) await appendTranscript(sid, role, merged);
  }
  buffers.clear();
}
