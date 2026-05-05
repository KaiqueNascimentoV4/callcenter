function stringifyContextValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyContextValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nested]) => {
        const rendered = stringifyContextValue(nested);
        return rendered ? `${key}: ${rendered}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value).trim();
}

export function normalizeLeadContext(contexto) {
  if (contexto == null) {
    return { raw: null, object: null, text: "" };
  }

  if (typeof contexto === "string") {
    return {
      raw: contexto,
      object: null,
      text: contexto.trim(),
    };
  }

  if (typeof contexto === "object") {
    return {
      raw: contexto,
      object: contexto,
      text: stringifyContextValue(contexto),
    };
  }

  return {
    raw: contexto,
    object: null,
    text: String(contexto).trim(),
  };
}

export function buildLeadContextPromptBlock(payloadExtras) {
  const text = payloadExtras?.contexto_texto?.trim?.() ?? "";
  if (!text) return "";
  return `\n\nContexto adicional do lead:\n${text}`;
}
