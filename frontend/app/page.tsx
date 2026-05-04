"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { statsApi, resultsApi, agentsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, TrendingUp, Users, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { interesseBadge, proximo } from "@/lib/badges";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: "easeOut" as const } }),
};

export default function Dashboard() {
  const [agentId, setAgentId] = useState<string>("all");

  const { data: agentsList } = useQuery({
    queryKey: ["agents", "for-dash"],
    queryFn: () => agentsApi.list(true),
  });

  const agentParams = agentId !== "all" ? { agent_id: agentId } : undefined;

  const { data: summary } = useQuery({
    queryKey: ["stats-summary", agentId],
    queryFn: () => statsApi.summary(agentParams),
  });

  const { data: chart } = useQuery({
    queryKey: ["stats-date", agentId],
    queryFn: () => statsApi.byDate(agentParams),
  });

  const { data: byAgent } = useQuery({
    queryKey: ["stats-by-agent"],
    queryFn: () => statsApi.byAgent(),
  });

  const { data: recent } = useQuery({
    queryKey: ["results-recent", agentId],
    queryFn: () =>
      resultsApi.list({
        limit: "10",
        ...(agentId !== "all" ? { agent_id: agentId } : {}),
      }),
  });

  const agentChartData =
    byAgent?.map((a) => ({
      name: a.agent_nome.length > 14 ? a.agent_nome.slice(0, 12) + "…" : a.agent_nome,
      fullName: a.agent_nome,
      total: a.total,
      alto: a.alto,
    })) ?? [];

  const cards = [
    { label: "Ligações hoje", value: summary?.ligacoes_hoje ?? "—", icon: PhoneCall, accent: "#ff4400" },
    { label: "Total de ligações", value: summary?.total_ligacoes ?? "—", icon: Users, accent: "#888" },
    { label: "Taxa interesse alto", value: summary ? `${summary.taxa_interesse_alto}%` : "—", icon: TrendingUp, accent: "#22c55e" },
    { label: "Taxa de conversão", value: summary ? `${summary.taxa_conversao}%` : "—", icon: Zap, accent: "#a855f7" },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-[#666] text-sm mt-1">Visão geral das ligações e resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#555] uppercase tracking-wide shrink-0">Agente</span>
          <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "all")}>
            <SelectTrigger className="w-[220px] bg-[#111] border-[#2a2a2a] text-[#ccc]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#161616] border-[#2a2a2a]">
              <SelectItem value="all">Todos os agentes</SelectItem>
              {agentsList?.map((a) => (
                <SelectItem key={a.id} value={a.id} disabled={!a.ativo}>
                  {a.nome}
                  {!a.ativo ? " (inativo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, accent }, i) => (
          <motion.div key={label} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <Card className="bg-[#111] border-[#1e1e1e] hover:border-[#2a2a2a] transition-colors">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] text-[#666] uppercase tracking-wide">{label}</p>
                    <p className="text-[28px] font-bold mt-1 leading-none text-white">{value}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
                    <Icon className="w-4 h-4" style={{ color: accent }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
        <Card className="bg-[#111] border-[#1e1e1e]">
          <CardHeader className="pb-4">
            <CardTitle className="text-[14px] font-medium text-[#aaa] uppercase tracking-wide">Ligações por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart ?? []}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#aaa" }}
                />
                <Line type="monotone" dataKey="total" stroke="#ff4400" strokeWidth={2} dot={false} name="Total" />
                <Line type="monotone" dataKey="alto" stroke="#22c55e" strokeWidth={2} dot={false} name="Alto interesse" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
        <Card className="bg-[#111] border-[#1e1e1e]">
          <CardHeader className="pb-4">
            <CardTitle className="text-[14px] font-medium text-[#aaa] uppercase tracking-wide">Volume por agente (global)</CardTitle>
          </CardHeader>
          <CardContent>
            {agentChartData.length === 0 ? (
              <p className="text-[#555] text-sm py-8 text-center">Sem dados agrupados por agente</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#555" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [
                      typeof value === "number" ? value : 0,
                      String(name) === "total" ? "Total" : "Alto interesse",
                    ]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return p?.fullName ?? "";
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" fill="#ff4400" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="alto" fill="#22c55e" name="Alto interesse" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
        <Card className="bg-[#111] border-[#1e1e1e]">
          <CardHeader className="pb-4">
            <CardTitle className="text-[14px] font-medium text-[#aaa] uppercase tracking-wide">Ligações recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e] text-[#555] text-left text-[11px] uppercase tracking-wide">
                  <th className="pb-3 font-medium">Lead</th>
                  <th className="pb-3 font-medium">Agente</th>
                  <th className="pb-3 font-medium">Interesse</th>
                  <th className="pb-3 font-medium">Próxima ação</th>
                  <th className="pb-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {recent?.data?.map((r) => (
                  <tr key={r.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616] transition-colors">
                    <td className="py-3 text-[#ccc]">{r.leads?.nome ?? r.lead_id ?? "—"}</td>
                    <td className="py-3 text-[#888]">{r.agents?.nome ?? "—"}</td>
                    <td className="py-3">
                      <Badge variant="outline" className={interesseBadge(r.interesse)}>
                        {r.interesse}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className="border-[#2a2a2a] text-[#888]">
                        {proximo(r.proxima_acao)}
                      </Badge>
                    </td>
                    <td className="py-3 text-[#555] text-[12px]">{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {!recent?.data?.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#555] text-sm">
                      Nenhuma ligação ainda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
