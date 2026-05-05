"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi, resultsApi } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Activity, CircleCheckBig, CircleOff, PhoneCall, Plus, Search, PencilLine, Trash2, Copy, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents", "management"],
    queryFn: () => agentsApi.list(true),
  });

  const { data: recentResults } = useQuery({
    queryKey: ["results", "agents-management"],
    queryFn: () => resultsApi.list({ limit: "100" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agente desativado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        !search ||
        [agent.nome, agent.empresa_nome, agent.voz, agent.modelo_gemini]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? agent.ativo : !agent.ativo);

      const matchesVoice = voiceFilter === "all" || agent.voz === voiceFilter;
      const matchesModel = modelFilter === "all" || agent.modelo_gemini === modelFilter;

      return matchesSearch && matchesStatus && matchesVoice && matchesModel;
    });
  }, [agents, modelFilter, search, statusFilter, voiceFilter]);

  const resultMap = useMemo(() => {
    const byAgent = new Map<string, { total: number; high: number }>();
    for (const result of recentResults?.data ?? []) {
      if (!result.agent_id) continue;
      const entry = byAgent.get(result.agent_id) ?? { total: 0, high: 0 };
      entry.total += 1;
      if (result.interesse === "alto") entry.high += 1;
      byAgent.set(result.agent_id, entry);
    }
    return byAgent;
  }, [recentResults?.data]);

  const voiceOptions = Array.from(new Set(agents.map((agent) => agent.voz).filter(Boolean)));
  const modelOptions = Array.from(new Set(agents.map((agent) => agent.modelo_gemini).filter(Boolean)));

  const totalAgents = agents.length;
  const activeAgents = agents.filter((agent) => agent.ativo).length;
  const inactiveAgents = totalAgents - activeAgents;
  const totalCalls = recentResults?.count ?? recentResults?.data?.length ?? 0;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Operação / Agentes"
        title="Agentes"
        description="Gerencie identidade, comportamento, contexto, integração e documentação de disparo dos agentes de voz em uma única central."
        actions={
          <Link href="/agents/new" className={buttonVariants({ className: "bg-primary text-primary-foreground hover:bg-primary/90" })}>
            <Plus className="mr-2 h-4 w-4" />
            Novo agente
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de agentes" value={totalAgents} hint="Todos os registros disponíveis" icon={Bot} />
        <StatCard label="Agentes ativos" value={activeAgents} hint="Prontos para receber leads" icon={CircleCheckBig} />
        <StatCard label="Agentes inativos" value={inactiveAgents} hint="Pausados ou desativados" icon={CircleOff} />
        <StatCard label="Chamadas recentes" value={totalCalls} hint="Baseado nas últimas ligações registradas" icon={PhoneCall} />
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="gap-4 border-b border-border/70 pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="text-lg text-foreground">Gestão de agentes</CardTitle>
                <p className="text-sm text-muted-foreground">Busque, filtre e abra a configuração completa de cada agente.</p>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-3 xl:justify-end">
                <div className="relative min-w-[240px] flex-1 xl:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, empresa, voz ou modelo" className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={voiceFilter} onValueChange={(value) => setVoiceFilter(value ?? "all")}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Voz" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as vozes</SelectItem>
                    {voiceOptions.map((voice) => <SelectItem key={voice} value={voice!}>{voice}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={modelFilter} onValueChange={(value) => setModelFilter(value ?? "all")}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Modelo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os modelos</SelectItem>
                    {modelOptions.map((model) => <SelectItem key={model} value={model!}>{model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando agentes...</div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Bot}
                  title="Nenhum agente encontrado"
                  description="Ajuste os filtros ou crie um novo agente para começar a automatizar ligações com contexto, voz e regras mais robustas."
                  actionLabel="Criar agente"
                  onAction={() => (window.location.href = "/agents/new")}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Agente</th>
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Voz</th>
                        <th className="px-4 py-3">Modelo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Performance</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredAgents.map((agent) => {
                      const metrics = resultMap.get(agent.id) ?? { total: 0, high: 0 };
                      const publicBase = typeof window !== "undefined"
                        ? window.location.origin.replace("call.", "api-call.")
                        : "";
                      const dispatchUrl = agent.webhook_entrada_token
                        ? `${publicBase}/hooks/inbound/${agent.webhook_entrada_token}`
                        : "";
                      return (
                        <tr key={agent.id} className="border-t border-border/70 align-top hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                                {agent.nome?.slice(0, 1)?.toUpperCase() ?? "A"}
                              </div>
                              <div className="space-y-1">
                                <div className="font-medium text-foreground">{agent.nome}</div>
                                <div className="text-xs text-muted-foreground">Atualizado em {agent.atualizado_em ? new Date(agent.atualizado_em).toLocaleDateString("pt-BR") : "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{agent.empresa_nome ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{agent.voz ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-xl border border-border bg-muted/40 px-3 py-1 text-xs text-foreground">
                              {agent.modelo_gemini ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={agent.ativo ? "border-green-500/40 text-green-500" : "border-border text-muted-foreground"}>
                              {agent.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-foreground">
                                <Activity className="h-4 w-4 text-primary" />
                                <span>{metrics.total} chamadas</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{metrics.high} com alto interesse</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {dispatchUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => navigator.clipboard.writeText(dispatchUrl).then(() => toast.success("Caminho de disparo copiado"))}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Link href={`/agents/${agent.id}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
                                <PencilLine className="h-4 w-4" />
                              </Link>
                              <Button type="button" variant="outline" size="icon" className="text-red-500" onClick={() => deactivateMutation.mutate(agent.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Boas práticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Configure prompts curtos, contexto útil e webhooks claros para manter a qualidade operacional alta.</p>
              <p>Quando houver poucos agentes, aproveite para padronizar tom de voz, scripts e critérios de qualificação antes de escalar.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/agents/new" className={buttonVariants({ variant: "outline", className: "w-full justify-between" })}>Criar novo agente <Plus className="h-4 w-4" /></Link>
              <Link href="/leads" className={buttonVariants({ variant: "outline", className: "w-full justify-between" })}>Importar e associar leads <ChevronRight className="h-4 w-4" /></Link>
              <Link href="/campaigns" className={buttonVariants({ variant: "outline", className: "w-full justify-between" })}>Iniciar campanha <ChevronRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
