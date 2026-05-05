"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { resultsApi, agentsApi, type CallResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { interesseBadge, humorBadge, proximo } from "@/lib/badges";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

type Bubble = { role: "user" | "agent"; texto: string; ts: string; ts_end?: string };

export default function ResultsPage() {
  const [interesse, setInteresse] = useState<string>("all");
  const [humor, setHumor] = useState<string>("all");
  const [proxima, setProxima] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CallResult | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loadingT, setLoadingT] = useState(false);

  const { data: agentsList } = useQuery({
    queryKey: ["agents", "for-results"],
    queryFn: () => agentsApi.list(false),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["results", interesse, humor, proxima, agentFilter],
    queryFn: () =>
      resultsApi.list({
        ...(interesse !== "all" ? { interesse } : {}),
        ...(humor !== "all" ? { humor } : {}),
        ...(proxima !== "all" ? { proxima_acao: proxima } : {}),
        ...(agentFilter !== "all" ? { agent_id: agentFilter } : {}),
      }),
  });

  async function openResult(r: CallResult) {
    setSelected(r);
    setLoadingT(true);
    try {
      const c = await resultsApi.conversation(r.call_sid);
      setBubbles(c.bubbles ?? []);
    } catch {
      setBubbles([]);
    } finally {
      setLoadingT(false);
    }
  }

  return (
    <div className="page-shell">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ligações</h1>
        <p className="text-muted-foreground text-sm mt-1">Histórico e transcrições (agregadas por fala)</p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-3 flex-wrap">
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agentsList?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {[
          {
            label: "Interesse",
            state: interesse,
            set: (v: string | null) => setInteresse(v ?? "all"),
            opts: ["alto", "medio", "baixo", "sem_interesse", "incerto"],
          },
          {
            label: "Humor",
            state: humor,
            set: (v: string | null) => setHumor(v ?? "all"),
            opts: ["positivo", "neutro", "negativo", "irritado", "incerto"],
          },
          {
            label: "Próxima ação",
            state: proxima,
            set: (v: string | null) => setProxima(v ?? "all"),
            opts: ["enviar_whatsapp", "enviar_email", "agendar_reuniao", "nao_contatar", "revisar_manualmente"],
          },
        ].map(({ label, state, set, opts }) => (
          <Select key={label} value={state} onValueChange={set}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({label})</SelectItem>
              {opts.map((o) => (
                <SelectItem key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Lead", "Agente", "Interesse", "Humor", "Próxima ação", "Resumo", "Data", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhuma ligação ainda
                </td>
              </tr>
            ) : (
              data?.data?.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{r.leads?.nome ?? r.lead_id ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.agents?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={interesseBadge(r.interesse)}>
                      {r.interesse}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={humorBadge(r.humor)}>
                      {r.humor}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {proximo(r.proxima_acao)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.resumo}</td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px] whitespace-nowrap">
                    {new Date(r.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="icon" variant="ghost" onClick={() => void openResult(r)} className="w-8 h-8 hover:bg-accent">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selected?.leads?.nome ?? "Detalhes da ligação"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {selected.agents?.nome && (
                <p className="text-[11px] text-muted-foreground">
                  Agente: <span className="text-foreground">{selected.agents.nome}</span>
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Interesse",
                    badge: (
                      <Badge variant="outline" className={interesseBadge(selected.interesse)}>
                        {selected.interesse}
                      </Badge>
                    ),
                  },
                  {
                    label: "Humor",
                    badge: (
                      <Badge variant="outline" className={humorBadge(selected.humor)}>
                        {selected.humor}
                      </Badge>
                    ),
                  },
                  {
                    label: "Próxima ação",
                    badge: <p className="font-medium text-foreground mt-1">{proximo(selected.proxima_acao)}</p>,
                  },
                ].map(({ label, badge }) => (
                  <div key={label} className="bg-muted rounded-lg p-3 border border-border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <div className="mt-1">{badge}</div>
                  </div>
                ))}
              </div>

              <div className="bg-muted rounded-lg p-3 border border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Resumo</p>
                <p className="text-foreground">{selected.resumo}</p>
              </div>

              <div>
                <p className="font-medium text-foreground mb-3">Conversa</p>
                {loadingT ? (
                  <p className="text-muted-foreground">Carregando transcrição…</p>
                ) : bubbles.length === 0 ? (
                  <p className="text-muted-foreground">Sem transcrição disponível</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {bubbles.map((t, i) => (
                      <div key={`${t.ts}-${i}`} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`rounded-xl px-3 py-2 max-w-[85%] text-sm ${
                            t.role === "agent"
                              ? "bg-primary/10 text-foreground border border-primary/20"
                              : "bg-muted text-foreground border border-border"
                          }`}
                        >
                          <span className="text-[10px] font-medium opacity-60 block mb-0.5">
                            {t.role === "agent" ? "Agente" : "Cliente"}
                          </span>
                          <p className="whitespace-pre-wrap">{t.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
