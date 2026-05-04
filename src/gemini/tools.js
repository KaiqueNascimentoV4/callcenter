export const salvarResultadoLigacaoDeclaration = {
  name: "salvar_resultado_ligacao",
  description: "Salva o resultado final da ligação no CRM. Deve ser chamada antes de encerrar a sessão.",
  parameters: {
    type: "object",
    properties: {
      confirmado: { type: "boolean" },
      pessoa_correta: { type: "boolean" },
      interesse: { type: "string", enum: ["alto", "medio", "baixo", "sem_interesse", "incerto"] },
      humor: { type: "string", enum: ["positivo", "neutro", "negativo", "irritado", "incerto"] },
      resumo: { type: "string", description: "Resumo objetivo da conversa (máx. 3 frases)." },
      proxima_acao: { type: "string", enum: ["enviar_whatsapp", "enviar_email", "agendar_reuniao", "nao_contatar", "revisar_manualmente"] },
    },
    required: ["confirmado", "pessoa_correta", "interesse", "humor", "resumo", "proxima_acao"],
  },
};

export const salvarInformacaoClienteDeclaration = {
  name: "salvar_informacao_cliente",
  description: "Salva uma informação relevante que o cliente mencionou durante a conversa, como orçamento, melhor horário, objeções, preferências, etc.",
  parameters: {
    type: "object",
    properties: {
      chave: { type: "string", description: "Nome da informação. Ex: orcamento, melhor_horario, objecao_principal, produto_interesse" },
      valor: { type: "string", description: "Valor da informação. Ex: R$ 5000, manhãs, preço muito alto, plano enterprise" },
    },
    required: ["chave", "valor"],
  },
};
