"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type Agent, type AgentDispatchPayload } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { FormSection } from "@/components/app/form-section";
import { StickyActionBar } from "@/components/app/sticky-action-bar";
import { CopyButton } from "@/components/app/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import { Bot, CheckCircle2, ChevronRight, ExternalLink, Loader2, PhoneCall, PlayCircle, Save, Sparkles, Volume2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type KVEntry = { key: string; value: string };

type AiWizardState = {
  empresa: string;
  produto: string;
  publico: string;
  objetivo: string;
  oferta: string;
  tom: "consultivo" | "direto" | "neutro";
  objecoes: string;
  cta: "whatsapp" | "reuniao" | "email" | "outro";
  restricoes: string;
  quem_fala_primeiro: "auto" | "agente" | "usuario";
};

type AiGeneratedResult = {
  prompt_template: string;
  instrucoes_background: string;
  empresa_contexto: Record<string, unknown>;
  quem_fala_primeiro: "agente" | "usuario";
};

const AI_STEPS: Array<{
  key: keyof AiWizardState;
  title: string;
  hint: string;
  placeholder?: string;
  type?: "text" | "textarea" | "select";
  options?: Array<{ value: string; label: string }>;
}> = [
  {
    key: "empresa",
    title: "Qual empresa esse agente representa?",
    hint: "Use o nome comercial que deve aparecer nas falas e no contexto interno.",
    placeholder: "Ex.: V4 Company Amaral",
  },
  {
    key: "produto",
    title: "O que ele está vendendo ou qualificando?",
    hint: "Produto, serviço ou oferta principal. Isso ancora a proposta de valor do roteiro.",
    placeholder: "Ex.: V4 Call para automação de ligações comerciais",
  },
  {
    key: "publico",
    title: "Quem é o público ideal?",
    hint: "Descreva o ICP com cargo, porte, segmento ou momento de compra.",
    placeholder: "Ex.: diretores comerciais de PMEs com time de SDR",
  },
  {
    key: "objetivo",
    title: "Qual é o objetivo principal da ligação?",
    hint: "Quanto mais claro, melhor a IA fecha a abertura e as perguntas de qualificação.",
    placeholder: "Ex.: qualificar e agendar uma reunião com especialista",
  },
  {
    key: "oferta",
    title: "Qual benefício ou oferta o agente precisa destacar?",
    hint: "Use a promessa principal, não uma lista inteira de features.",
    placeholder: "Ex.: reduzir o tempo de resposta e aumentar conversão",
  },
  {
    key: "objecoes",
    title: "Quais objeções ele deve saber responder?",
    hint: "Liste objeções reais do comercial para a IA se preparar melhor.",
    placeholder: "Ex.: já usamos CRM, sem tempo, preciso falar com sócio",
    type: "textarea",
  },
  {
    key: "cta",
    title: "Qual é o próximo passo ideal?",
    hint: "Isso guia o fechamento do roteiro e a proposta de ação.",
    type: "select",
    options: [
      { value: "reuniao", label: "Agendar reunião" },
      { value: "whatsapp", label: "Enviar WhatsApp" },
      { value: "email", label: "Enviar e-mail" },
      { value: "outro", label: "Outro CTA" },
    ],
  },
  {
    key: "tom",
    title: "Qual tom de abordagem faz mais sentido?",
    hint: "Ferramentas maduras dão controle de estilo logo na criação. Vamos fazer o mesmo aqui.",
    type: "select",
    options: [
      { value: "consultivo", label: "Consultivo" },
      { value: "direto", label: "Direto" },
      { value: "neutro", label: "Neutro" },
    ],
  },
];

const MODEL_OPTIONS = [
  "gemini-2.0-flash-live-001",
  "gemini-2.5-flash-live-preview",
  "gemini-3.1-flash-live-preview",
];

const VOICE_OPTIONS = ["Kore", "Aoede", "Charon", "Fenrir", "Puck", "Orbit", "Zephyr", "Leda", "Orus", "Autonoe"];

const EMPTY_AGENT: Partial<Agent> = {
  nome: "",
  ativo: true,
  empresa_nome: "",
  empresa_contexto: {},
  prompt_template: "",
  instrucoes_background: "",
  modelo_gemini: "gemini-2.5-flash-live-preview",
  voz: "Kore",
  timeout_segundos: 120,
  quem_fala_primeiro: "agente",
  webhook_saida_url: "",
  telefone_json_path: "$.telefone",
  vad_silencio_ms: 800,
  vad_sensibilidade_inicio: "START_SENSITIVITY_LOW",
  vad_sensibilidade_fim: "END_SENSITIVITY_LOW",
  interrupcao_habilitada: true,
  primeiro_turno_delay_ms: 500,
  silencio_encerrar_seg: 0,
  deteccao_voicemail: false,
};

const SAMPLE_DATA = {
  nome: "Marina Almeida",
  empresa: "Ritmo Growth",
  cargo: "Diretora Comercial",
  origem: "evento presencial",
  objetivo: "qualificar interesse em automação de atendimento",
  oferta: "V4 Call",
};

function kvFromObj(obj: Record<string, unknown> | null | undefined): KVEntry[] {
  return Object.entries(obj ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

function kvToObj(entries: KVEntry[]): Record<string, unknown> {
  return Object.fromEntries(entries.filter((entry) => entry.key.trim()).map((entry) => [entry.key.trim(), entry.value]));
}

function renderPrompt(template: string | undefined, values = SAMPLE_DATA) {
  const source = template?.trim()
    ? template
    : "Olá, {{nome}}. Falo da {{empresa}} sobre {{oferta}}. Quero entender seu momento em {{objetivo}}.";

  return source
    .replace(/\{\{nome\}\}/g, values.nome)
    .replace(/\{\{empresa\}\}/g, values.empresa)
    .replace(/\{\{cargo\}\}/g, values.cargo)
    .replace(/\{\{origem\}\}/g, values.origem)
    .replace(/\{\{objetivo\}\}/g, values.objetivo)
    .replace(/\{\{oferta\}\}/g, values.oferta);
}

function formatPayloadExample(agent: Partial<Agent>) {
  return JSON.stringify(
    {
      telefone: "+5511999999999",
      nome: "Marina Almeida",
      contexto: {
        empresa: "Ritmo Growth",
        cargo: "Diretora Comercial",
        interesse: "Automação de atendimento",
        observacao: "Prefere contato pela manhã",
      },
      metadata: {
        origem: "crm",
        campaign_id: "campanha-demo",
      },
      telefone_json_path: agent.telefone_json_path ?? "$.telefone",
    },
    null,
    2,
  );
}

function fieldComplete(value: unknown) {
  return typeof value === "string" ? Boolean(value.trim()) : Boolean(value);
}

function AgentEditorShell({ agentId, initialAgent }: { agentId?: string; initialAgent: Partial<Agent> }) {
  const isNew = !agentId;
  const initialContextEntries = kvFromObj(initialAgent.empresa_contexto);
  const router = useRouter();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [form, setForm] = useState<Partial<Agent>>(initialAgent);
  const [contextEntries, setContextEntries] = useState<KVEntry[]>(initialContextEntries);
  const [newContext, setNewContext] = useState<KVEntry>({ key: "", value: "" });
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiGenerated, setAiGenerated] = useState<AiGeneratedResult | null>(null);
  const [aiState, setAiState] = useState<AiWizardState>(() => ({
    empresa: String(initialAgent.empresa_nome ?? ""),
    produto: "V4 Call",
    publico: "",
    objetivo: "",
    oferta: "",
    tom: "consultivo",
    objecoes: "",
    cta: "reuniao",
    restricoes: "",
    quem_fala_primeiro: "auto",
  }));
  const [dispatchPayload, setDispatchPayload] = useState<AgentDispatchPayload>({
    telefone: "",
    nome: SAMPLE_DATA.nome,
    contexto: { empresa: SAMPLE_DATA.empresa, cargo: SAMPLE_DATA.cargo, observacao: "Teste de pré-qualificação" },
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [playingPreview, setPlayingPreview] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ next: initialAgent, context: initialContextEntries }));

  const currentSnapshot = useMemo(
    () => JSON.stringify({ form, context: contextEntries }),
    [form, contextEntries],
  );
  const isDirty = baseline !== "" && baseline !== currentSnapshot;
  const currentAiStep = AI_STEPS[Math.min(aiStep, AI_STEPS.length - 1)];
  const aiCompletion = Math.round(((Math.min(aiStep, AI_STEPS.length) + (aiGenerated ? 1 : 0)) / (AI_STEPS.length + 1)) * 100);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const webhookUrl = useMemo(() => {
    if (!form.webhook_entrada_token) return "";
    const base = typeof window !== "undefined" ? window.location.origin.replace("call.", "api-call.") : "";
    const fallback = process.env.NEXT_PUBLIC_API_BASE?.startsWith("http") ? process.env.NEXT_PUBLIC_API_BASE : base;
    return `${fallback.replace(/\/$/, "")}/hooks/inbound/${form.webhook_entrada_token}`;
  }, [form.webhook_entrada_token]);

  async function generateWithAi() {
    setAiGenerating(true);
    try {
      const { data: json, error } = await getSupabase().functions.invoke("generate-agent-script", {
        body: aiState,
      });
      if (error) throw new Error(error.message || "Falha ao gerar script com IA");

      const empresa_contexto =
        json?.empresa_contexto && typeof json.empresa_contexto === "object" ? json.empresa_contexto : {};

      setAiGenerated({
        prompt_template: json.prompt_template ?? "",
        instrucoes_background: json.instrucoes_background ?? "",
        empresa_contexto,
        quem_fala_primeiro: json.quem_fala_primeiro ?? "agente",
      });
      setAiStep(AI_STEPS.length);
      toast.success("Rascunho gerado. Revise e escolha o que aplicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "N?o foi poss?vel gerar com IA");
    } finally {
      setAiGenerating(false);
    }
  }

  function openAiCopilot() {
    setAiGenerated(null);
    setAiStep(0);
    setAiState((prev) => ({
      ...prev,
      empresa: String(form.empresa_nome ?? prev.empresa ?? ""),
    }));
    setAiOpen(true);
  }

  function applyGenerated(mode: "prompt" | "all") {
    if (!aiGenerated) return;

    if (mode === "prompt") {
      setForm((prev) => ({
        ...prev,
        empresa_nome: prev.empresa_nome || aiState.empresa,
        prompt_template: aiGenerated.prompt_template || prev.prompt_template,
        instrucoes_background: aiGenerated.instrucoes_background || prev.instrucoes_background,
      }));
    } else {
      setContextEntries(kvFromObj(aiGenerated.empresa_contexto));
      setForm((prev) => ({
        ...prev,
        empresa_nome: prev.empresa_nome || aiState.empresa,
        prompt_template: aiGenerated.prompt_template || prev.prompt_template,
        instrucoes_background: aiGenerated.instrucoes_background || prev.instrucoes_background,
        quem_fala_primeiro: aiGenerated.quem_fala_primeiro ?? prev.quem_fala_primeiro,
      }));
    }

    toast.success(mode === "prompt" ? "Prompt aplicado ao agente" : "Script completo aplicado ao agente");
    setAiOpen(false);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        empresa_contexto: kvToObj(contextEntries),
        webhook_saida_url: form.webhook_saida_url || null,
        telefone_json_path: form.telefone_json_path || null,
      };

      if (isNew) return agentsApi.create(payload);
      return agentsApi.update(agentId!, payload);
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agents"] }),
        queryClient.invalidateQueries({ queryKey: ["agent", saved.id] }),
      ]);
      setForm(saved);
      setContextEntries(kvFromObj(saved.empresa_contexto));
      setBaseline(JSON.stringify({ next: saved, context: kvFromObj(saved.empresa_contexto) }));
      toast.success("Agente salvo com sucesso");
      if (isNew) router.replace(`/agents/${saved.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => agentsApi.regenerateToken(agentId!),
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setBaseline(JSON.stringify({ next: saved, context: kvFromObj(saved.empresa_contexto) }));
      toast.success("Novo token gerado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => agentsApi.dispatch(agentId!, dispatchPayload),
    onSuccess: (data) => {
      toast.success(`Teste disparado: ${data.callSid}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const readinessItems = [
    { label: "Nome configurado", ok: fieldComplete(form.nome) },
    { label: "Empresa configurada", ok: fieldComplete(form.empresa_nome) },
    { label: "Voz selecionada", ok: fieldComplete(form.voz) },
    { label: "Modelo selecionado", ok: fieldComplete(form.modelo_gemini) },
    { label: "Mensagem inicial pronta", ok: fieldComplete(form.prompt_template) },
    { label: "Instruções internas", ok: fieldComplete(form.instrucoes_background) },
    { label: "Configuração de ligação válida", ok: Number(form.timeout_segundos ?? 0) >= 30 },
    { label: "Webhook de saída", ok: !form.webhook_saida_url || /^https?:\/\//.test(form.webhook_saida_url) },
    { label: "Token de disparo", ok: fieldComplete(form.webhook_entrada_token) },
  ];

  async function playVoicePreview() {
    if (!agentId) {
      toast.error("Salve o agente antes de testar a voz");
      return;
    }

    setPlayingPreview(true);
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = `${agentsApi.voicePreviewUrl(agentId)}?t=${Date.now()}`;
      audioRef.current.onended = () => setPlayingPreview(false);
      await audioRef.current.play();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reproduzir o preview");
      setPlayingPreview(false);
    }
  }

  function updateContextEntry(index: number, patch: Partial<KVEntry>) {
    setContextEntries((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addContextEntry() {
    if (!newContext.key.trim()) return;
    setContextEntries((prev) => [...prev, { key: newContext.key.trim(), value: newContext.value }]);
    setNewContext({ key: "", value: "" });
  }

  function removeContextEntry(index: number) {
    setContextEntries((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function applyPreset(preset: "balanced" | "responsive" | "conservative") {
    const mapping = {
      balanced: {
        vad_silencio_ms: 800,
        primeiro_turno_delay_ms: 500,
        vad_sensibilidade_inicio: "START_SENSITIVITY_LOW",
        vad_sensibilidade_fim: "END_SENSITIVITY_LOW",
      },
      responsive: {
        vad_silencio_ms: 500,
        primeiro_turno_delay_ms: 250,
        vad_sensibilidade_inicio: "START_SENSITIVITY_HIGH",
        vad_sensibilidade_fim: "END_SENSITIVITY_HIGH",
      },
      conservative: {
        vad_silencio_ms: 1200,
        primeiro_turno_delay_ms: 800,
        vad_sensibilidade_inicio: "START_SENSITIVITY_LOW",
        vad_sensibilidade_fim: "END_SENSITIVITY_LOW",
      },
    } as const;
    setForm((prev) => ({ ...prev, ...mapping[preset] }));
  }

  function insertPlaceholder(placeholder: string, field: "prompt_template" | "instrucoes_background") {
    setForm((prev) => ({ ...prev, [field]: `${prev[field] ?? ""}${placeholder}` }));
  }

  function handleNavigateAway(href: string) {
    if (isDirty && !window.confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return;
    router.push(href);
  }

  return (
    <div className="page-shell pb-8">
      <PageHeader
        eyebrow={isNew ? "Agentes / Novo" : "Agentes / Editar"}
        title={isNew ? "Novo agente" : form.nome || "Editar agente"}
        description="Central de configuração de IA de voz com contexto, comportamento, webhooks, documentação de disparo e área de teste."
        actions={
          <>
            <Button variant="outline" onClick={() => handleNavigateAway("/agents")}>Cancelar</Button>
            <Button type="button" variant="outline" onClick={openAiCopilot}>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar com IA
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </>
        }
      />

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="overflow-hidden border-border bg-card p-0 sm:max-w-5xl">
          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-b border-border bg-muted/30 p-6 lg:border-b-0 lg:border-r">
              <DialogHeader className="space-y-3 text-left">
                <DialogTitle className="text-xl">Copiloto de script com IA</DialogTitle>
                <DialogDescription>
                  Vamos estruturar o roteiro como uma ferramenta de voz madura: contexto, objetivo, CTA e obje??es bem amarrados.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Progresso</span>
                    <span>{aiCompletion}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border/70">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${aiCompletion}%` }} />
                  </div>
                </div>

                <div className="space-y-2">
                  {AI_STEPS.map((step, index) => {
                    const done = index < aiStep || Boolean((aiState[step.key] ?? "").toString().trim());
                    const active = index === aiStep && !aiGenerated;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => !aiGenerated && setAiStep(index)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                          active ? "border-primary/40 bg-primary/8" : "border-border bg-background hover:bg-accent/50",
                        )}
                      >
                        <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold", done ? "border-primary/40 bg-primary/12 text-primary" : "border-border text-muted-foreground")}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{step.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6">
              {!aiGenerated ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-background p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Pergunta atual</p>
                    <h3 className="mt-3 text-xl font-semibold text-foreground">{currentAiStep.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{currentAiStep.hint}</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sua resposta</Label>
                    {currentAiStep.type === "textarea" ? (
                      <Textarea
                        className="min-h-[180px]"
                        value={String(aiState[currentAiStep.key] ?? "")}
                        placeholder={currentAiStep.placeholder}
                        onChange={(e) => setAiState((s) => ({ ...s, [currentAiStep.key]: e.target.value }))}
                      />
                    ) : currentAiStep.type === "select" ? (
                      <Select
                        value={String(aiState[currentAiStep.key] ?? currentAiStep.options?.[0]?.value ?? "")}
                        onValueChange={(value) => setAiState((s) => ({ ...s, [currentAiStep.key]: value }))}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {currentAiStep.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(aiState[currentAiStep.key] ?? "")}
                        placeholder={currentAiStep.placeholder}
                        onChange={(e) => setAiState((s) => ({ ...s, [currentAiStep.key]: e.target.value }))}
                      />
                    )}
                  </div>

                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Resumo at? aqui</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {AI_STEPS.map((step) => {
                        const value = String(aiState[step.key] ?? "").trim();
                        if (!value) return null;
                        return (
                          <div key={step.key} className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{step.title}</p>
                            <p className="mt-1 text-sm text-foreground">{value}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <DialogFooter className="flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" type="button" onClick={() => setAiOpen(false)} disabled={aiGenerating}>Cancelar</Button>
                      <Button variant="outline" type="button" onClick={() => setAiStep((prev) => Math.max(prev - 1, 0))} disabled={aiGenerating || aiStep === 0}>Anterior</Button>
                    </div>
                    {aiStep < AI_STEPS.length - 1 ? (
                      <Button type="button" onClick={() => setAiStep((prev) => Math.min(prev + 1, AI_STEPS.length - 1))}>
                        Pr?xima pergunta
                      </Button>
                    ) : (
                      <Button type="button" onClick={() => void generateWithAi()} disabled={aiGenerating} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Gerar roteiro
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border border-primary/20 bg-primary/6 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Rascunho pronto</p>
                    <h3 className="mt-3 text-xl font-semibold text-foreground">A IA montou um primeiro script para este agente</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Voc? pode aplicar s? o prompt ou preencher tamb?m instru??es internas, contexto e comportamento inicial.</p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <Card className="border-border bg-background">
                      <CardHeader>
                        <CardTitle className="text-base">Mensagem inicial</CardTitle>
                        <CardDescription>Primeira fala sugerida pela IA j? com placeholders v?lidos.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6 text-foreground">{aiGenerated.prompt_template}</pre>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-background">
                      <CardHeader>
                        <CardTitle className="text-base">Contexto e instru??es</CardTitle>
                        <CardDescription>Resumo do material que ser? aplicado ao agente.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Instru??es internas</p>
                          <p className="mt-2 text-sm leading-6 text-foreground">{aiGenerated.instrucoes_background || "Sem instru??es complementares."}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Contexto gerado</p>
                          <div className="mt-2 space-y-2">
                            {Object.entries(aiGenerated.empresa_contexto).slice(0, 8).map(([key, value]) => (
                              <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{key}</p>
                                <p className="mt-1 text-sm text-foreground">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <DialogFooter className="flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" type="button" onClick={() => { setAiGenerated(null); setAiStep(0); }}>Refazer perguntas</Button>
                      <Button variant="outline" type="button" onClick={() => setAiOpen(false)}>Fechar</Button>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => applyGenerated("prompt")}>Aplicar s? prompt</Button>
                      <Button type="button" onClick={() => applyGenerated("all")} className="bg-primary text-primary-foreground hover:bg-primary/90">Aplicar tudo</Button>
                    </div>
                  </DialogFooter>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Link href="/agents" className="hover:text-foreground">Agentes</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{isNew ? "Novo agente" : form.nome || "Editar"}</span>
        <Badge variant="outline" className={cn("ml-2", form.ativo ? "border-green-500/40 text-green-500" : "border-border text-muted-foreground")}>
          {form.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="panel-grid">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="h-auto w-full flex-wrap justify-center gap-2 rounded-xl border border-border bg-card p-2 lg:justify-center xl:justify-between">
              {[
                ["overview", "Visão geral"],
                ["prompt", "Prompt e comportamento"],
                ["context", "Contexto da empresa"],
                ["call", "Configurações da ligação"],
                ["integrations", "Webhooks e integrações"],
                ["test", "Teste do agente"],
              ].map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="min-w-[170px] rounded-lg px-4 py-2 text-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground xl:min-w-[150px]">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <FormSection title="Identidade e operação" description="Defina como o agente aparece no produto e quais defaults operacionais ele usa.">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do agente</Label>
                    <Input value={form.nome ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa / marca</Label>
                    <Input value={form.empresa_nome ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, empresa_nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo Gemini</Label>
                    <Select value={form.modelo_gemini ?? MODEL_OPTIONS[0]} onValueChange={(value) => setForm((prev) => ({ ...prev, modelo_gemini: value ?? MODEL_OPTIONS[0] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Modelos mais novos soam melhores, mas podem variar em custo e latência.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Voz</Label>
                    <Select value={form.voz ?? VOICE_OPTIONS[0]} onValueChange={(value) => setForm((prev) => ({ ...prev, voz: value ?? VOICE_OPTIONS[0] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => void playVoicePreview()} disabled={playingPreview || isNew}>
                        {playingPreview ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Volume2 className="mr-2 h-3.5 w-3.5" />}
                        Preview de voz
                      </Button>
                      <span className="text-xs text-muted-foreground">Usa Gemini TTS e respeita voz/modelo do agente.</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quem fala primeiro</Label>
                    <Select value={form.quem_fala_primeiro ?? "agente"} onValueChange={(value) => setForm((prev) => ({ ...prev, quem_fala_primeiro: (value ?? "agente") as "agente" | "usuario" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agente">Agente</SelectItem>
                        <SelectItem value="usuario">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Quando o agente fala primeiro, ele inicia assim que a ligação conecta.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout total da ligação (s)</Label>
                    <Input type="number" min={30} max={600} value={form.timeout_segundos ?? 120} onChange={(e) => setForm((prev) => ({ ...prev, timeout_segundos: Number(e.target.value) }))} />
                    <p className="text-xs text-muted-foreground">Limite máximo da sessão antes do encerramento automático.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Status operacional</p>
                    <p className="text-sm text-muted-foreground">Ative ou pause este agente sem remover sua configuração.</p>
                  </div>
                  <Switch checked={form.ativo ?? true} onCheckedChange={(value) => setForm((prev) => ({ ...prev, ativo: value }))} />
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="prompt" className="space-y-6">
              <FormSection
                title="Mensagem inicial e instruções internas"
                description="Separe o que o agente diz do que ele precisa saber para se comportar bem."
                aside={
                  <div className="flex flex-wrap gap-2">
                    {["{{nome}}", "{{empresa}}", "{{cargo}}", "{{origem}}", "{{objetivo}}", "{{oferta}}"].map((placeholder) => (
                      <Button key={placeholder} type="button" size="sm" variant="outline" onClick={() => insertPlaceholder(placeholder, "prompt_template")}>
                        {placeholder}
                      </Button>
                    ))}
                  </div>
                }
              >
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <Label>Mensagem inicial / prompt do agente</Label>
                    <Textarea
                      className="min-h-[220px] font-mono text-sm"
                      value={form.prompt_template ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, prompt_template: e.target.value }))}
                      placeholder="Olá, {{nome}}. Falo da {{empresa}} sobre {{oferta}}..."
                    />
                    <p className="text-xs text-muted-foreground">Use placeholders para personalizar a abertura sem perder consistência.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Instruções internas do agente</Label>
                    <Textarea
                      className="min-h-[180px]"
                      value={form.instrucoes_background ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, instrucoes_background: e.target.value }))}
                      placeholder="Tom de voz, objeções comuns, limites de negociação e tudo que a IA deve seguir."
                    />
                  </div>
                  <Card className="border-border bg-muted/40">
                    <CardHeader>
                      <CardTitle className="text-base">Preview da primeira fala</CardTitle>
                      <CardDescription>Renderização com dados de exemplo para validar clareza, placeholders e tom.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-foreground">
                        {renderPrompt(form.prompt_template)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="context" className="space-y-6">
              <FormSection title="Contexto da empresa" description="Informações de apoio para a IA responder com mais repertório e precisão.">
                <div className="space-y-4">
                  {contextEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                      Nenhum contexto cadastrado. Adicione políticas, diferenciais, regiões atendidas, oferta principal ou objeções comuns.
                    </div>
                  ) : (
                    contextEntries.map((entry, index) => (
                      <div key={`${entry.key}-${index}`} className="grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-[1fr_1.4fr_auto]">
                        <Input value={entry.key} onChange={(e) => updateContextEntry(index, { key: e.target.value })} placeholder="Chave" />
                        <Input value={entry.value} onChange={(e) => updateContextEntry(index, { value: e.target.value })} placeholder="Valor" />
                        <Button type="button" variant="outline" size="icon" onClick={() => removeContextEntry(index)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                  <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 md:grid-cols-[1fr_1.4fr_auto]">
                    <Input value={newContext.key} onChange={(e) => setNewContext((prev) => ({ ...prev, key: e.target.value }))} placeholder="Nova chave" />
                    <Input value={newContext.value} onChange={(e) => setNewContext((prev) => ({ ...prev, value: e.target.value }))} placeholder="Novo valor" />
                    <Button type="button" onClick={addContextEntry}>Adicionar</Button>
                  </div>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="call" className="space-y-6">
              <FormSection
                title="Configurações da ligação"
                description="Ajuste o equilíbrio entre naturalidade, latência e interrupção. Presets ajudam a começar rápido."
                aside={
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("conservative")}>Conservador</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("balanced")}>Equilibrado</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyPreset("responsive")}>Responsivo</Button>
                  </div>
                }
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Silêncio VAD (ms)</Label>
                    <Input type="number" min={200} max={2000} step={100} value={form.vad_silencio_ms ?? 800} onChange={(e) => setForm((prev) => ({ ...prev, vad_silencio_ms: Number(e.target.value) }))} />
                    <p className="text-xs text-muted-foreground">Valores menores deixam o agente mais responsivo, mas podem aumentar cortes prematuros.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Delay do primeiro turno (ms)</Label>
                    <Input type="number" min={0} max={5000} step={100} value={form.primeiro_turno_delay_ms ?? 500} onChange={(e) => setForm((prev) => ({ ...prev, primeiro_turno_delay_ms: Number(e.target.value) }))} />
                    <p className="text-xs text-muted-foreground">Aguarda um pouco antes de falar, deixando a abertura menos abrupta.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sensibilidade de início</Label>
                    <Select value={form.vad_sensibilidade_inicio ?? "START_SENSITIVITY_LOW"} onValueChange={(value) => setForm((prev) => ({ ...prev, vad_sensibilidade_inicio: value ?? "START_SENSITIVITY_LOW" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="START_SENSITIVITY_LOW">Baixa</SelectItem>
                        <SelectItem value="START_SENSITIVITY_MEDIUM">Média</SelectItem>
                        <SelectItem value="START_SENSITIVITY_HIGH">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sensibilidade de fim</Label>
                    <Select value={form.vad_sensibilidade_fim ?? "END_SENSITIVITY_LOW"} onValueChange={(value) => setForm((prev) => ({ ...prev, vad_sensibilidade_fim: value ?? "END_SENSITIVITY_LOW" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="END_SENSITIVITY_LOW">Baixa</SelectItem>
                        <SelectItem value="END_SENSITIVITY_MEDIUM">Média</SelectItem>
                        <SelectItem value="END_SENSITIVITY_HIGH">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Encerrar após silêncio (s)</Label>
                    <Input type="number" min={0} max={300} step={5} value={form.silencio_encerrar_seg ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, silencio_encerrar_seg: Number(e.target.value) }))} />
                    <p className="text-xs text-muted-foreground">Use 0 para manter a chamada aberta até o encerramento natural.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">Interrupção habilitada</p>
                        <p className="text-xs text-muted-foreground">Permite o cliente cortar a fala do agente.</p>
                      </div>
                      <Switch checked={form.interrupcao_habilitada ?? true} onCheckedChange={(value) => setForm((prev) => ({ ...prev, interrupcao_habilitada: value }))} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">Detecção de voicemail</p>
                        <p className="text-xs text-muted-foreground">Usa Answering Machine Detection do Twilio para evitar caixa postal.</p>
                      </div>
                      <Switch checked={form.deteccao_voicemail ?? false} onCheckedChange={(value) => setForm((prev) => ({ ...prev, deteccao_voicemail: value }))} />
                    </div>
                  </div>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <FormSection title="Webhooks e integrações" description="Documentação pronta para disparar o agente de outros sistemas e receber resultado final.">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>Webhook de saída</Label>
                    <Input value={form.webhook_saida_url ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, webhook_saida_url: e.target.value }))} placeholder="https://seu-sistema.com/webhooks/calls" />
                    <p className="text-xs text-muted-foreground">Recebe lead, agent, call, resumo, interesse, humor e transcrição em bubbles.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-border bg-background">
                      <CardHeader>
                        <CardTitle className="text-base">URL de disparo</CardTitle>
                        <CardDescription>Use em CRM, automações ou outros sistemas para criar o lead e iniciar a ligação.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <code className="block rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground break-all">
                          {webhookUrl || "Salve o agente para gerar o token de disparo."}
                        </code>
                        {webhookUrl ? <CopyButton value={webhookUrl} label="Copiar URL" /> : null}
                        {form.webhook_entrada_token ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Token</p>
                            <div className="flex items-center gap-3">
                              <code className="flex-1 rounded-xl border border-border bg-muted/40 p-3 text-xs break-all">{form.webhook_entrada_token}</code>
                              {!isNew ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
                                  {regenerateMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                                  Regenerar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-background">
                      <CardHeader>
                        <CardTitle className="text-base">Payload de exemplo</CardTitle>
                        <CardDescription>Compatível com `contexto` em texto ou objeto JSON.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-foreground">
                          {formatPayloadExample(form)}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-2">
                    <Label>JSONPath do telefone</Label>
                    <Input value={form.telefone_json_path ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, telefone_json_path: e.target.value }))} placeholder="$.telefone" />
                    <p className="text-xs text-muted-foreground">Quando o payload vier aninhado, este caminho ajuda a localizar o número automaticamente.</p>
                  </div>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="test" className="space-y-6">
              <FormSection title="Teste do agente" description="Valide a primeira abordagem, o preview de voz e um disparo real com payload de exemplo.">
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="mb-2 font-medium text-foreground">Mensagem inicial simulada</p>
                    <p className="text-sm leading-6 text-foreground">{renderPrompt(form.prompt_template)}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Telefone de teste</Label>
                      <Input value={dispatchPayload.telefone} onChange={(e) => setDispatchPayload((prev) => ({ ...prev, telefone: e.target.value }))} placeholder="+5511999999999" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do lead</Label>
                      <Input value={dispatchPayload.nome ?? ""} onChange={(e) => setDispatchPayload((prev) => ({ ...prev, nome: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Contexto do lead</Label>
                    <Textarea
                      className="min-h-[160px] font-mono text-sm"
                      value={typeof dispatchPayload.contexto === "string" ? dispatchPayload.contexto : JSON.stringify(dispatchPayload.contexto ?? {}, null, 2)}
                      onChange={(e) => {
                        const value = e.target.value;
                        try {
                          setDispatchPayload((prev) => ({ ...prev, contexto: JSON.parse(value) }));
                        } catch {
                          setDispatchPayload((prev) => ({ ...prev, contexto: value }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => void playVoicePreview()} disabled={playingPreview || isNew}>
                      {playingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                      Testar voz
                    </Button>
                    <Button type="button" onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending || !agentId || !dispatchPayload.telefone} className="bg-primary text-primary-foreground hover:bg-primary/90">
                      {dispatchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                      Disparar teste
                    </Button>
                    <span className="text-xs text-muted-foreground">O disparo usa o mesmo endpoint público do agente, com contexto salvo no lead.</span>
                  </div>
                </div>
              </FormSection>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" /> Prontidão do agente</CardTitle>
              <CardDescription>Checklist rápido para evitar publicar um agente incompleto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <span className="text-sm text-foreground">{item.label}</span>
                  {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" /> : <XCircle className="mt-0.5 h-4 w-4 text-amber-500" />}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Dicas rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Use prompts curtos, objetivos e com contexto suficiente para a primeira abordagem soar humana.</p>
              <p>Contexto da empresa deve conter o que a IA precisa lembrar com frequência, não tudo que já existe em outros sistemas.</p>
              <p>Em agentes mais agressivos, reduza delay e silêncio; em agentes mais consultivos, prefira presets equilibrados ou conservadores.</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Primeira fala</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-foreground">{renderPrompt(form.prompt_template)}</p>
            </CardContent>
          </Card>

          {webhookUrl ? (
            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">URL pública</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <code className="block rounded-xl border border-border bg-background p-3 text-xs break-all">{webhookUrl}</code>
                <div className="flex flex-wrap items-center gap-3">
                  <CopyButton value={webhookUrl} />
                  <Link href={webhookUrl} target="_blank" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
                    Abrir <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <StickyActionBar
        message={isDirty ? "Você tem alterações não salvas. Salve antes de sair para não perder ajustes deste agente." : "Tudo salvo. Você pode seguir para outro agente ou voltar à listagem."}
        actions={
          <>
            <Button variant="outline" onClick={() => handleNavigateAway("/agents")}>Voltar para agentes</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar alterações
            </Button>
          </>
        }
      />
    </div>
  );
}

export function AgentEditor({ agentId }: { agentId?: string }) {
  const isNew = !agentId;
  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => agentsApi.get(agentId!),
    enabled: Boolean(agentId),
  });

  if (!isNew && isLoading) {
    return <div className="page-shell"><div className="h-96 animate-pulse rounded-3xl border border-border bg-card" /></div>;
  }

  return <AgentEditorShell key={agentId ?? "new"} agentId={agentId} initialAgent={agent ?? EMPTY_AGENT} />;
}
