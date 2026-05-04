import twilio from "twilio";

let _client;
function client() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return _client;
}

/**
 * Cria uma ligação outbound para o lead.
 *
 * @param {object} opts
 * @param {string} opts.to        Número destino no formato E.164 (+5511...)
 * @param {string} opts.leadId    ID do lead (passado ao TwiML via query param)
 * @param {string} [opts.campaignId]
 * @returns {Promise<object>} Objeto de chamada Twilio
 */
export async function createCall({ to, leadId, campaignId }) {
  const twimlUrl = new URL(`${process.env.PUBLIC_BASE_URL}/twiml/voice`);
  twimlUrl.searchParams.set("leadId", leadId);
  if (campaignId) twimlUrl.searchParams.set("campaignId", campaignId);

  const call = await client().calls.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: twimlUrl.toString(),
    method: "POST",
  });

  console.log(`[Twilio] Call created: ${call.sid} → ${to}`);
  return call;
}
