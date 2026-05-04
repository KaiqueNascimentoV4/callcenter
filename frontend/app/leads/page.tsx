"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi, agentsApi, type Lead } from "@/lib/api";
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

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", contactado: "Contactado", convertido: "Convertido",
  nao_contatar: "Não contatar", arquivado: "Arquivado",
};

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
    <div className="space-y-6 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Leads</h1>
          <p className="text-[#666] text-sm mt-1">{data?.count ?? 0} leads cadastrados</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpenForm(true); }} className="bg-[#ff4400] hover:bg-[#e03d00] text-white border-0">
          <Plus className="w-4 h-4 mr-1.5" /> Novo lead
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex gap-3">
        <Input placeholder="Buscar por nome, empresa ou telefone…" value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs bg-[#111] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-44 bg-[#111] border-[#2a2a2a] text-[#ccc]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#161616] border-[#2a2a2a]">
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
          <SelectTrigger className="w-48 bg-[#111] border-[#2a2a2a] text-[#ccc]"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent className="bg-[#161616] border-[#2a2a2a]">
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
        className="rounded-xl border border-[#1e1e1e] bg-[#111] overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-[#1e1e1e]">
            <tr>
              {["Nome", "Empresa", "Telefone", "Agente", "Status", "Tentativas", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-[#555] text-[11px] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-[#555]">Carregando…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-[#555]">Nenhum lead encontrado</td></tr>
            ) : data?.data?.map((lead) => (
              <tr key={lead.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616] transition-colors">
                <td className="px-4 py-3 font-medium text-white">{lead.nome}</td>
                <td className="px-4 py-3 text-[#888]">{lead.empresa ?? "—"}</td>
                <td className="px-4 py-3 text-[#888]">{lead.telefone}</td>
                <td className="px-4 py-3 text-[#888]">{lead.agents?.nome ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={statusBadge(lead.status)}>{STATUS_LABELS[lead.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-[#666]">{lead.tentativas}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => call.mutate(lead.id)} title="Ligar agora"
                      className="w-8 h-8 hover:bg-green-500/10">
                      <Phone className="w-3.5 h-3.5 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setForm(lead); setOpenForm(true); }}
                      className="w-8 h-8 hover:bg-[#2a2a2a]">
                      <Pencil className="w-3.5 h-3.5 text-[#888]" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(lead.id)}
                      className="w-8 h-8 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setSelectedLead(lead.id)}
                      className="w-8 h-8 hover:bg-[#2a2a2a]">
                      <ChevronRight className="w-3.5 h-3.5 text-[#888]" />
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
        <DialogContent className="max-w-lg bg-[#111] border-[#2a2a2a]">
          <DialogHeader><DialogTitle className="text-white">{form.id ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs mb-1 text-[#888]">Agente</Label>
              <Select
                value={form.agent_id ?? "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v === "none" ? undefined : v }))}
              >
                <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc]">
                  <SelectValue placeholder="Padrão global" />
                </SelectTrigger>
                <SelectContent className="bg-[#161616] border-[#2a2a2a]">
                  <SelectItem value="none">Padrão global (bot)</SelectItem>
                  {agentsList?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: "nome", label: "Nome *", placeholder: "João Silva" },
              { key: "telefone", label: "Telefone *", placeholder: "+5511999999999" },
              { key: "empresa", label: "Empresa", placeholder: "TechCorp" },
              { key: "cargo", label: "Cargo", placeholder: "Diretor Comercial" },
              { key: "origem", label: "Origem", placeholder: "formulário web" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label className="text-xs mb-1 text-[#888]">{label}</Label>
                <Input placeholder={placeholder}
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]"
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-xs mb-1 text-[#888]">Objetivo da ligação</Label>
              <Input placeholder="confirmar interesse em receber proposta"
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]"
                value={form.objetivo ?? ""} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 text-[#888]">Produto / oferta</Label>
              <Input placeholder="Automação de atendimento"
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]"
                value={form.oferta ?? ""} onChange={e => setForm(f => ({ ...f, oferta: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} className="border-[#2a2a2a] text-[#888] hover:text-white">Cancelar</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}
              className="bg-[#ff4400] hover:bg-[#e03d00] text-white border-0">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!selectedLead} onOpenChange={o => !o && setSelectedLead(null)}>
        <SheetContent className="w-[420px] overflow-y-auto bg-[#0f0f0f] border-[#1e1e1e]">
          <SheetHeader><SheetTitle className="text-white">{detail?.nome}</SheetTitle></SheetHeader>
          {detail && (
            <div className="mt-4 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-y-3 text-[#888]">
                {[
                  ["Agente", detail.agents?.nome ?? "Padrão global"],
                  ["Empresa", detail.empresa ?? "—"],
                  ["Cargo", detail.cargo ?? "—"],
                  ["Telefone", detail.telefone],
                  ["Tentativas", String(detail.tentativas)],
                ].map(([k, v]) => (
                  <span key={k} className="contents">
                    <span className="font-medium text-[#ccc]">{k}</span>
                    <span>{v}</span>
                  </span>
                ))}
                <span className="font-medium text-[#ccc]">Status</span>
                <Badge variant="outline" className={statusBadge(detail.status)}>{STATUS_LABELS[detail.status]}</Badge>
              </div>

              <div>
                <p className="font-medium text-[#ccc] mb-2">Informações coletadas</p>
                {detail.info_chave?.length === 0 && <p className="text-[#555] text-xs">Nenhuma ainda</p>}
                <div className="space-y-1">
                  {detail.info_chave?.map(i => (
                    <div key={i.id} className="flex gap-2 bg-[#1a1a1a] rounded-lg px-3 py-1.5">
                      <span className="font-medium text-[#ccc]">{i.chave}:</span>
                      <span className="text-[#888]">{i.valor}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input placeholder="chave" value={newInfo.chave} onChange={e => setNewInfo(n => ({ ...n, chave: e.target.value }))}
                    className="h-8 text-xs bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]" />
                  <Input placeholder="valor" value={newInfo.valor} onChange={e => setNewInfo(n => ({ ...n, valor: e.target.value }))}
                    className="h-8 text-xs bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] placeholder:text-[#444]" />
                  <Button size="sm" onClick={() => addInfo.mutate()} className="bg-[#ff4400] hover:bg-[#e03d00] text-white border-0 h-8">+</Button>
                </div>
              </div>

              <div>
                <p className="font-medium text-[#ccc] mb-2">Histórico de ligações</p>
                {detail.historico_ligacoes?.length === 0 && <p className="text-[#555] text-xs">Nenhuma ligação ainda</p>}
                <div className="space-y-2">
                  {detail.historico_ligacoes?.map(r => (
                    <div key={r.id} className="border border-[#1e1e1e] bg-[#141414] rounded-lg px-3 py-2 space-y-1">
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${interesseBadge(r.interesse)}`}>{r.interesse}</Badge>
                        <span className="text-[#555] text-xs">{new Date(r.criado_em).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-[#888] text-xs">{r.resumo}</p>
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
