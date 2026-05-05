"use client";

import { Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { agentsApi, resultsApi, statsApi } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, PhoneCall, TrendingUp, Users, Zap } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import { interesseBadge, proximo } from "@/lib/badges";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") ?? "all";

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", "dashboard"],
    queryFn: () => agentsApi.list(true),
  });

  const { data: summary } = useQuery({
    queryKey: ["stats-summary", agentId],
    queryFn: () => statsApi.summary(agentId !== "all" ? { agent_id: agentId } : undefined),
  });

  const { data: byDate } = useQuery({
    queryKey: ["stats-by-date", agentId],
    queryFn: () => statsApi.byDate(agentId !== "all" ? { agent_id: agentId } : undefined),
  });

  const { data: byAgent } = useQuery({
    queryKey: ["stats-by-agent"],
    queryFn: () => statsApi.byAgent(),
  });

  const { data: recent } = useQuery({
    queryKey: ["results-recent", agentId],
    queryFn: () =>
      resultsApi.list({
        limit: "12",
        ...(agentId !== "all" ? { agent_id: agentId } : {}),
      }),
  });

  const selectedAgent = agents.find((agent) => agent.id === agentId);

  const chartData = useMemo(
    () =>
      (byAgent ?? [])
        .filter((row) => agentId === "all" || row.agent_id === agentId)
        .map((row) => ({
          name: row.agent_nome,
          total: row.total,
          alto: row.alto,
        })),
    [agentId, byAgent],
  );

  const activeAgentsCount = agents.filter((agent) => agent.ativo).length;

  function setAgent(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("agent");
    else params.set("agent", value);
    router.replace(`/?${params.toString()}`);
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={agentId === "all" ? "Visão global" : "Visão por agente"}
        title={agentId === "all" ? "Dashboard" : `Dashboard · ${selectedAgent?.nome ?? "Agente"}`}
        description={agentId === "all"
          ? "Acompanhe volume, interesse e evolução do time de agentes em uma visão operacional mais completa."
          : "Todas as métricas, ligações recentes e tendências desta página estão centradas no agente selecionado."}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Contexto</span>
            <Select value={agentId} onValueChange={(value) => setAgent(value ?? "all")}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Todos os agentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.nome}{!agent.ativo ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Ligações hoje" value={summary?.ligacoes_hoje ?? "—"} hint="Volume do dia" icon={PhoneCall} />
        <StatCard label="Total de ligações" value={summary?.total_ligacoes ?? "—"} hint="Janela registrada no sistema" icon={Users} />
        <StatCard label="Interesse alto" value={summary ? `${summary.taxa_interesse_alto}%` : "—"} hint="Taxa de alta intenção" icon={TrendingUp} />
        <StatCard label="Conversão" value={summary ? `${summary.taxa_conversao}%` : "—"} hint="Alto ou médio interesse" icon={Zap} />
        <StatCard label="Agentes ativos" value={agentId === "all" ? activeAgentsCount : selectedAgent?.ativo ? 1 : 0} hint={agentId === "all" ? "Ativos no ecossistema" : "Status do agente selecionado"} icon={Bot} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Evolução diária</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={byDate ?? []}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, fontSize: 12 }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} dot={false} name="Total" />
                <Line type="monotone" dataKey="alto" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Alto interesse" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              {agentId === "all" ? "Ranking por agente" : "Volume do agente selecionado"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Sem dados suficientes para este recorte.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, fontSize: 12 }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" fill="var(--primary)" name="Total" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="alto" fill="#22c55e" name="Alto interesse" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Ligações recentes</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Agente</th>
                  <th className="px-4 py-3 font-semibold">Interesse</th>
                  <th className="px-4 py-3 font-semibold">Próxima ação</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent?.data?.map((result) => (
                  <tr key={result.id} className="border-b border-border/70 last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-foreground">{result.leads?.nome ?? result.lead_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{result.agents?.nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={interesseBadge(result.interesse)}>
                        {result.interesse}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{proximo(result.proxima_acao)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(result.criado_em).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {!recent?.data?.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma ligação registrada ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="h-96 animate-pulse rounded-xl border border-border bg-card" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
