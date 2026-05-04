import twilio from "twilio";

/**
 * Gera TwiML com <Connect><Stream> bidirecional apontando para /media.
 * Parâmetros (leadId, campaignId, etc.) são passados via <Parameter>
 * porque a Twilio não aceita query string no atributo url do <Stream>.
 *
 * @param {object} params  Chave-valor a incluir como <Parameter>
 * @returns {string} TwiML XML
 */
export function buildStreamTwiml(params = {}) {
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();

  const stream = connect.stream({
    url: process.env.WS_PUBLIC_URL,
  });

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      stream.parameter({ name, value: String(value) });
    }
  }

  return response.toString();
}
