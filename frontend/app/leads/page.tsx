"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, agentsApi, campaignsApi, type Lead } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusBadge, interesseBadge } from "@/lib/badges";
import { Phone, Plus, Trash2, Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/page-header";

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", contactado: "Contactado", convertido: "Convertido",
  nao_contatar: "Não contatar", arquivado: "Arquivado",
};

const E164_RE = /^\+[1-9]\d{7,14}$/;

const EMPTY: Partial<Lead> = {
  nome: "",
  telefone: "",
  empresa: "",
  cargo: "",
  origem: "",
  objetivo: "",
  oferta: "",
  status: "novo",
  agent_id: undefined,
  campaign_id: undefined,
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [form, setForm] = useState<Partial<Lead>>(EMPTY);
  const [openForm, setOpenForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [newInfo, setNewInfo] = useState({ chave: "", valor: "" });

  const { data: agentsList } = useQuery({
    queryKey: ["agents", "for-leads"],
    queryFn: () => agentsApi.list(false),
  });

  const { data: campaignsList } = useQuery({
    queryKey: ["campaigns", "for-leads"],
    queryFn: () => campaignsApi.list(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", search, statusFilter, agentFilter],
    queryFn: () =>
      leadsApi.list({
        ...(search ? { q: search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(agentFilter !== "all" ? { agent_id: agentFilter } : {}),
      }),
  });

  const { data: detail } = useQuery({
    queryKey: ["lead-detail", selectedLead],
    queryFn: () => leadsApi.get(selectedLead!),
    enabled: !!selectedLead,
  });

  const save = useMutation({
    mutationFn: async (l: Partial<Lead>) => {
      if (!l.nome?.trim()) throw new Error("Nome é obrigatório");
      if (!l.telefone?.trim()) throw new Error("Telefone é obrigatório");
      if (!E164_RE.test(l.telefone.trim())) throw new Error("Telefone deve estar no formato E.164 (ex: +5511999999999)");
      const payload = { ...l };
      const editingExisting = Boolean(l.id && data?.data?.some((x) => x.id === l.id));
      if (!editingExisting) {
        delete (payload as Partial<Lead>).id;
        return leadsApi.create(payload);
      }
      return leadsApi.update(l.id!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpenForm(false);
      toast.success("Lead salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead removido"); },
  });

  const call = useMutation({
    mutationFn: (id: string) => leadsApi.call(id),
    onSuccess: (d) => toast.success(`Ligação iniciada: ${d.callSid}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const addInfo = useMutation({
    mutationFn: () => leadsApi.addInfo(selectedLead!, newInfo.chave, newInfo.valor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead-detail"] }); setNewInfo({ chave: "", valor: "" }); toast.success("Info salva"); },
  });

  return (
    <div className="page-shell">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <PageHeader
          eyebrow="Operação / Leads"
          title="Leads"
          description={`${data?.count ?? 0} leads cadastrados, com associação a agente, campanha e histórico operacional.`}
          actions={
            <Button onClick={() => { setForm(EMPTY); setOpenForm(true); }} className="bg-primary hover:bg-primary/90 text-foreground border-0">
              <Plus className="w-4 h-4 mr-1.5" /> Novo lead
            </Button>
          }
        />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nome, empresa ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agentsList?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {["Nome", "Empresa", "Telefone", "Agente", "Status", "Tentativas", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Carregando…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum lead encontrado</td></tr>
            ) : data?.data?.map((lead) => (
              <tr key={lead.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{lead.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{lead.empresa ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{lead.telefone}</td>
                <td className="px-4 py-3 text-muted-foreground">{lead.agents?.nome ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={statusBadge(lead.status)}>{STATUS_LABELS[lead.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.tentativas}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => call.mutate(lead.id)} title="Ligar agora"
                      className="w-8 h-8 hover:bg-green-500/10">
                      <Phone className="w-3.5 h-3.5 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setForm(lead); setOpenForm(true); }}
                      className="w-8 h-8">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(lead.id)}
                      className="w-8 h-8 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setSelectedLead(lead.id)}
                      className="w-8 h-8">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Form dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{form.id ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="text-xs mb-1 text-muted-foreground">Agente</Label>
              <Select
                value={form.agent_id ?? "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v === "none" ? undefined : v }))}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Padrão global" />
                </SelectTrigger>
                <SelectContent className="bg-accent border-border">
                  <SelectItem value="none">Padrão global (bot)</SelectItem>
                  {agentsList?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 text-muted-foreground">Campanha</Label>
              <Select
                value={form.campaign_id ?? "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, campaign_id: v === "none" ? undefined : v ?? undefined }))}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent className="bg-accent border-border">
                  <SelectItem value="none">Nenhuma campanha</SelectItem>
                  {campaignsList?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: "nome", label: "Nome *", placeholder: "João Silva" },
              { key: "telefone", label: "Telefone * (E.164)", placeholder: "+5511999999999" },
              { key: "empresa", label: "Empresa", placeholder: "TechCorp" },
              { key: "cargo", label: "Cargo", placeholder: "Diretor Comercial" },
              { key: "origem", label: "Origem", placeholder: "formulário web" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label className="text-xs mb-1 text-muted-foreground">{label}</Label>
                <Input placeholder={placeholder}
                  className={`bg-muted border-border text-foreground placeholder:text-muted-foreground ${
                    key === "telefone" && form.telefone && !E164_RE.test(form.telefone)
                      ? "border-red-500/60"
                      : ""
                  }`}
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-xs mb-1 text-muted-foreground">Objetivo da ligação</Label>
              <Input placeholder="confirmar interesse em receber proposta"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                value={form.objetivo ?? ""} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 text-muted-foreground">Produto / oferta</Label>
              <Input placeholder="Automação de atendimento"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                value={form.oferta ?? ""} onChange={e => setForm(f => ({ ...f, oferta: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} className="border-border text-muted-foreground hover:text-foreground">Cancelar</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}
              className="bg-primary hover:bg-primary/90 text-foreground border-0">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!selectedLead} onOpenChange={o => !o && setSelectedLead(null)}>
        <SheetContent className="w-[420px] overflow-y-auto bg-card border-border">
          <SheetHeader><SheetTitle className="text-foreground">{detail?.nome}</SheetTitle></SheetHeader>
          {detail && (
            <div className="mt-4 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-y-3 text-muted-foreground">
                {[
                  ["Agente", detail.agents?.nome ?? "Padrão global"],
                  ["Empresa", detail.empresa ?? "—"],
                  ["Cargo", detail.cargo ?? "—"],
                  ["Telefone", detail.telefone],
                  ["Tentativas", String(detail.tentativas)],
                ].map(([k, v]) => (
                  <span key={k} className="contents">
                    <span className="font-medium text-foreground">{k}</span>
                    <span>{v}</span>
                  </span>
                ))}
                <span className="font-medium text-foreground">Status</span>
                <Badge variant="outline" className={statusBadge(detail.status)}>{STATUS_LABELS[detail.status]}</Badge>
              </div>

              <div>
                <p className="font-medium text-foreground mb-2">Informações coletadas</p>
                {detail.info_chave?.length === 0 && <p className="text-muted-foreground text-xs">Nenhuma ainda</p>}
                <div className="space-y-1">
                  {detail.info_chave?.map(i => (
                    <div key={i.id} className="flex gap-2 bg-muted rounded-lg px-3 py-1.5">
                      <span className="font-medium text-foreground">{i.chave}:</span>
                      <span className="text-muted-foreground">{i.valor}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input placeholder="chave" value={newInfo.chave} onChange={e => setNewInfo(n => ({ ...n, chave: e.target.value }))}
                    className="h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground" />
                  <Input placeholder="valor" value={newInfo.valor} onChange={e => setNewInfo(n => ({ ...n, valor: e.target.value }))}
                    className="h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground" />
                  <Button size="sm" onClick={() => addInfo.mutate()} className="bg-primary hover:bg-primary/90 text-foreground border-0 h-8">+</Button>
                </div>
              </div>

              <div>
                <p className="font-medium text-foreground mb-2">Histórico de ligações</p>
                {detail.historico_ligacoes?.length === 0 && <p className="text-muted-foreground text-xs">Nenhuma ligação ainda</p>}
                <div className="space-y-2">
                  {detail.historico_ligacoes?.map(r => (
                    <div key={r.id} className="border border-border bg-card rounded-lg px-3 py-2 space-y-1">
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${interesseBadge(r.interesse)}`}>{r.interesse}</Badge>
                        <span className="text-muted-foreground text-xs">{new Date(r.criado_em).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">{r.resumo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
