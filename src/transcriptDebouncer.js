import { appendTranscript } from "./db/callResults.js";

const buffers = new Map();

function bufKey(callSid, role) {
  return `${callSid}\0${role}`;
}

function oppositeRole(role) {
  return role === "agent" ? "user" : "agent";
}

async function flush(callSid, role) {
  const k = bufKey(callSid, role);
  const b = buffers.get(k);
  if (!b) return;
  clearTimeout(b.timer);
  const merged = b.parts.join(" ");
  buffers.delete(k);
  if (merged.trim()) await appendTranscript(callSid, role, merged);
}

/**
 * Acumula chunks STT e faz um único insert após silêncio.
 * Quando chega texto de um role e existe buffer pendente do role oposto,
 * faz flush imediato no buffer oposto (troca de turno real).
 */
export function debouncedAppendTranscript(callSid, role, texto, ms = 1200) {
  if (!callSid || !texto?.trim()) return;

  // Flush imediato no buffer do role oposto ao detectar troca de turno
  const otherKey = bufKey(callSid, oppositeRole(role));
  if (buffers.has(otherKey)) {
    void flush(callSid, oppositeRole(role));
  }

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
