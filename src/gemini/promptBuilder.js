/**
 * Monta o system prompt para cada lead.
 * `agentConfig` vem de getEffectiveAgentConfig (agente + fallback bot_config).
 */
export function buildPromptForLead(lead, agentConfig = {}) {
  const empresa = agentConfig.empresa_nome ?? "[EMPRESA]";
  const template = agentConfig.prompt_template?.trim();

  let ctxBlock = "";
  const ec = agentConfig.empresa_contexto;
  if (ec && typeof ec === "object" && Object.keys(ec).length) {
    ctxBlock += `\n\nDados de contexto (empresa / agente):\n${JSON.stringify(ec, null, 2)}`;
  }
  const bg = agentConfig.instrucoes_background?.trim();
  if (bg) ctxBlock += `\n\nInstruções de background do agente:\n${bg}`;

  if (template) {
    let t = template
      .replace(/\{\{nome\}\}/g, lead.nome ?? "cliente")
      .replace(/\{\{empresa\}\}/g, lead.empresa ?? "não informada")
      .replace(/\{\{cargo\}\}/g, lead.cargo ?? "não informado")
      .replace(/\{\{origem\}\}/g, lead.origem ?? "não informada")
      .replace(/\{\{objetivo\}\}/g, lead.objetivo ?? "apresentar a empresa")
      .replace(/\{\{oferta\}\}/g, lead.oferta ?? "não especificado");
    return t + ctxBlock;
  }

  const base = `Você é um agente de voz da ${empresa}.

Contexto da ligação:
- Nome do contato: ${lead.nome ?? "cliente"}
- Empresa: ${lead.empresa ?? "não informada"}
- Cargo: ${lead.cargo ?? "não informado"}
- Origem do lead: ${lead.origem ?? "não informada"}
- Objetivo: ${lead.objetivo ?? "apresentar a empresa e verificar interesse"}
- Produto/oferta: ${lead.oferta ?? "não especificado"}

Sua missão:
1. Cumprimente de forma breve e natural.
2. Confirme se está falando com ${lead.nome ?? "a pessoa indicada"}.
3. Explique em uma frase o motivo da ligação.
4. Faça no máximo 2 perguntas.
5. Se houver interesse, confirme o melhor próximo passo.
6. Se não houver interesse, respeite imediatamente.
7. Se o cliente mencionar informações relevantes (orçamento, preferências, objeções), chame salvar_informacao_cliente.
8. Ao encerrar, chame salvar_resultado_ligacao.

Estilo:
- Português brasileiro coloquial e natural.
- Frases curtas — no máximo 2 frases por turno.
- Nunca fale como robô; não mencione que está seguindo um script.
- Nunca invente dados.
- Não pressione a pessoa.
- Se a pessoa pedir para não ligar mais, classifique proxima_acao como "nao_contatar".`;

  return ctxBlock ? ctxBlock.trim() + "\n\n" + base : base;
}
