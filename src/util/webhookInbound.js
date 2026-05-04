/**
 * Extrai telefone E.164 de um JSON arbitrário (primeira ocorrência).
 */
export function findPhoneInJson(obj) {
  if (obj == null) return null;
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  const m = s.match(/\+[1-9]\d{10,14}\b/);
  return m ? m[0] : null;
}

/**
 * Caminho simples estilo `$.contact.phone` ou `contact.phone`.
 */
export function getJsonPath(obj, path) {
  if (!path || path === "$") return obj;
  const clean = path.replace(/^\$\./, "").trim();
  if (!clean) return obj;
  const parts = clean.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}
