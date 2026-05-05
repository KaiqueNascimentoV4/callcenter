"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi, campaignsApi, leadsApi, type Lead, type LeadBulkActionPayload } from "@/lib/api";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { interesseBadge, statusBadge } from "@/lib/badges";
import {
  ChevronRight,
  Phone,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  contactado: "Contactado",
  convertido: "Convertido",
  nao_contatar: "Não contatar",
  arquivado: "Arquivado",
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

function parseBulkText(raw: string): Partial<Lead>[] {
  const normalized = raw.trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const firstParts = lines[0].split(separator).map((part) => part.trim().toLowerCase());
  const hasHeader = firstParts.some((part) => ["nome", "telefone", "empresa", "cargo", "origem", "objetivo", "oferta"].includes(part));

  if (hasHeader) {
    const headers = lines[0].split(separator).map((part) => part.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const parts = line.split(separator).map((part) => part.trim());
      const lead: Partial<Lead> = { status: "novo" };
      headers.forEach((header, index) => {
        const value = parts[index] ?? "";
        if (header === "nome") lead.nome = value;
        if (header === "telefone") lead.telefone = value;
        if (header === "empresa") lead.empresa = value;
        if (header === "cargo") lead.cargo = value;
        if (header === "origem") lead.origem = value;
        if (header === "objetivo") lead.objetivo = value;
        if (header === "oferta") lead.oferta = value;
      });
      return lead;
    }).filter((lead) => lead.nome && lead.telefone);
  }

  return lines
    .map((line) => {
      const [nome = "", telefone = "", empresa = "", cargo = "", origem = "", objetivo = "", oferta = ""] = line
        .split(separator)
        .map((part) => part.trim());
      return { nome, telefone, empresa, cargo, origem, objetivo, oferta, status: "novo" as const };
    })
    .filter((lead) => lead.nome && lead.telefone);
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [form, setForm] = useState<Partial<Lead>>(EMPTY);
  const [openForm, setOpenForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [newInfo, setNewInfo] = useState({ chave: "", valor: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkPayload, setBulkPayload] = useState<{ agent_id: string; campaign_id: string }>({ agent_id: "none", campaign_id: "none" });
  const [bulkText, setBulkText] = useState("");

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

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = rows.length > 0 && rows.every((lead) => selectedIds.includes(lead.id));

  const save = useMutation({
    mutationFn: async (lead: Partial<Lead>) => {
      if (!lead.nome?.trim()) throw new Error("Nome é obrigatório");
      if (!lead.telefone?.trim()) throw new Error("Telefone é obrigatório");
      if (!E164_RE.test(lead.telefone.trim())) throw new Error("Telefone deve estar no formato E.164 (ex: +5511999999999)");
      const payload = { ...lead };
      const editingExisting = Boolean(lead.id && rows.some((row) => row.id === lead.id));
      if (!editingExisting) {
        delete (payload as Partial<Lead>).id;
        return leadsApi.create(payload);
      }
      return leadsApi.update(lead.id!, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      setOpenForm(false);
      toast.success("Lead salvo");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const call = useMutation({
    mutationFn: (id: string) => leadsApi.call(id),
    onSuccess: (response) => toast.success(`Ligação iniciada: ${response.callSid}`),
    onError: (error: Error) => toast.error(error.message),
  });

  const addInfo = useMutation({
    mutationFn: () => leadsApi.addInfo(selectedLead!, newInfo.chave, newInfo.valor),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lead-detail"] });
      setNewInfo({ chave: "", valor: "" });
      toast.success("Informação salva");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkAction = useMutation({
    mutationFn: (payload: LeadBulkActionPayload) => leadsApi.bulk(payload),
    onSuccess: async (response) => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      setSelectedIds([]);
      setBulkAssignOpen(false);
      toast.success(`${response.affected} leads atualizados`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkImport = useMutation({
    mutationFn: async () => {
      const parsed = parseBulkText(bulkText);
      if (parsed.length === 0) throw new Error("Nenhum lead válido encontrado no conteúdo informado");
      return leadsApi.import(parsed);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      setBulkImportOpen(false);
      setBulkText("");
      toast.success("Leads importados com sucesso");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visibleStats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((lead) => lead.status !== "arquivado").length;
    const unassigned = rows.filter((lead) => !lead.agent_id).length;
    return { total, active, unassigned };
  }, [rows]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !rows.some((lead) => lead.id === id));
      const next = new Set(prev);
      rows.forEach((lead) => next.add(lead.id));
      return Array.from(next);
    });
  }

  return (
    <div className="page-shell gap-5">
      <PageHeader
        eyebrow="Operação / Leads"
        title="Leads"
        description={`${data?.count ?? 0} leads cadastrados, com associação a agente, campanha e histórico operacional.`}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setBulkImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Adicionar em massa
            </Button>
            <Button
              onClick={() => {
                setForm(EMPTY);
                setOpenForm(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Leads visíveis" value={visibleStats.total} hint="Resultado do filtro atual" icon={Users} />
        <StatCard label="Ativos" value={visibleStats.active} hint="Não arquivados" icon={UserRoundCheck} />
        <StatCard label="Sem agente" value={visibleStats.unassigned} hint="Prontos para distribuição" icon={Plus} />
      </section>

      <Card className="border-border bg-card shadow-[var(--shadow-xs)]">
        <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar por nome, empresa ou telefone..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={(value) => setAgentFilter(value ?? "all")}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {agentsList?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{selectedCount} selecionados</span>
            {selectedCount > 0 ? (
              <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => setSelectedIds([])}>
                <X className="h-3.5 w-3.5" />
                limpar
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 ? (
        <Card className="border-primary/20 bg-primary/5 shadow-[var(--shadow-xs)]">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium text-foreground">{selectedCount} leads selecionados</p>
              <p className="text-sm text-muted-foreground">Use as ações em massa para distribuir operação ou arquivar itens rapidamente.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setBulkAssignOpen(true)}>
                Atribuir em massa
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => bulkAction.mutate({ action: "delete", leadIds: selectedIds })}
                disabled={bulkAction.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir em massa
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead encontrado"
          description="Importe uma base em lote, cadastre manualmente ou ajuste os filtros para encontrar o que precisa."
          actionLabel="Adicionar em massa"
          onAction={() => setBulkImportOpen(true)}
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                  />
                </th>
                {["Nome", "Empresa", "Telefone", "Agente", "Status", "Tentativas", ""].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : (
                rows.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => toggleRow(lead.id)}
                        className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{lead.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.empresa ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.telefone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.agents?.nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(lead.status)}>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.tentativas}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => call.mutate(lead.id)} title="Ligar agora" className="h-8 w-8 hover:bg-green-500/10">
                          <Phone className="h-3.5 w-3.5 text-green-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setForm(lead);
                            setOpenForm(true);
                          }}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove.mutate(lead.id)} className="h-8 w-8 hover:bg-red-500/10">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setSelectedLead(lead.id)} className="h-8 w-8">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form.id ? "Editar lead" : "Novo lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Agente</Label>
              <Select
                value={form.agent_id ?? "none"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, agent_id: value === "none" ? undefined : value }))}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Padrão global" />
                </SelectTrigger>
                <SelectContent className="bg-accent border-border">
                  <SelectItem value="none">Padrão global (bot)</SelectItem>
                  {agentsList?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Campanha</Label>
              <Select
                value={form.campaign_id ?? "none"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, campaign_id: value === "none" ? undefined : value ?? undefined }))}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent className="bg-accent border-border">
                  <SelectItem value="none">Nenhuma campanha</SelectItem>
                  {campaignsList?.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.nome}
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
                <Label className="mb-1 text-xs text-muted-foreground">{label}</Label>
                <Input
                  placeholder={placeholder}
                  className={`bg-muted border-border text-foreground placeholder:text-muted-foreground ${
                    key === "telefone" && form.telefone && !E164_RE.test(form.telefone) ? "border-red-500/60" : ""
                  }`}
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="mb-1 text-xs text-muted-foreground">Objetivo da ligação</Label>
              <Input
                placeholder="confirmar interesse em receber proposta"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                value={form.objetivo ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, objetivo: event.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1 text-xs text-muted-foreground">Produto / oferta</Label>
              <Input
                placeholder="Automação de atendimento"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                value={form.oferta ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, oferta: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Atribuir em massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Você está atualizando <span className="font-medium text-foreground">{selectedCount}</span> leads.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Agente</Label>
                <Select value={bulkPayload.agent_id} onValueChange={(value) => setBulkPayload((prev) => ({ ...prev, agent_id: value ?? "none" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem alteração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem alteração</SelectItem>
                    {agentsList?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Campanha</Label>
                <Select value={bulkPayload.campaign_id} onValueChange={(value) => setBulkPayload((prev) => ({ ...prev, campaign_id: value ?? "none" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem alteração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem alteração</SelectItem>
                    {campaignsList?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                bulkAction.mutate({
                  action: "assign",
                  leadIds: selectedIds,
                  ...(bulkPayload.agent_id !== "none" ? { agent_id: bulkPayload.agent_id } : {}),
                  ...(bulkPayload.campaign_id !== "none" ? { campaign_id: bulkPayload.campaign_id } : {}),
                })
              }
              disabled={bulkAction.isPending || (bulkPayload.agent_id === "none" && bulkPayload.campaign_id === "none")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar leads em massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Cole CSV com cabeçalho `nome,telefone,empresa,cargo,origem,objetivo,oferta` ou linhas simples na mesma ordem.
            </p>
            <Textarea
              className="min-h-[260px] font-mono text-sm"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"nome,telefone,empresa,cargo,origem,objetivo,oferta\nMarina,+5511999999999,Ritmo Growth,Diretora,eventos,Qualificar interesse,V4 Call"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => bulkImport.mutate()} disabled={bulkImport.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {bulkImport.isPending ? "Importando..." : "Importar leads"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-[420px] overflow-y-auto border-border bg-card">
          <SheetHeader>
            <SheetTitle className="text-foreground">{detail?.nome}</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className="mt-4 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-y-3 text-muted-foreground">
                {[
                  ["Agente", detail.agents?.nome ?? "Padrão global"],
                  ["Empresa", detail.empresa ?? "—"],
                  ["Cargo", detail.cargo ?? "—"],
                  ["Telefone", detail.telefone],
                  ["Tentativas", String(detail.tentativas)],
                ].map(([key, value]) => (
                  <span key={key} className="contents">
                    <span className="font-medium text-foreground">{key}</span>
                    <span>{value}</span>
                  </span>
                ))}
                <span className="font-medium text-foreground">Status</span>
                <Badge variant="outline" className={statusBadge(detail.status)}>
                  {STATUS_LABELS[detail.status]}
                </Badge>
              </div>

              <div>
                <p className="mb-2 font-medium text-foreground">Informações coletadas</p>
                {detail.info_chave?.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma ainda</p> : null}
                <div className="space-y-1">
                  {detail.info_chave?.map((item) => (
                    <div key={item.id} className="flex gap-2 rounded-lg bg-muted px-3 py-1.5">
                      <span className="font-medium text-foreground">{item.chave}:</span>
                      <span className="text-muted-foreground">{item.valor}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="chave"
                    value={newInfo.chave}
                    onChange={(event) => setNewInfo((prev) => ({ ...prev, chave: event.target.value }))}
                    className="h-8 bg-muted text-xs"
                  />
                  <Input
                    placeholder="valor"
                    value={newInfo.valor}
                    onChange={(event) => setNewInfo((prev) => ({ ...prev, valor: event.target.value }))}
                    className="h-8 bg-muted text-xs"
                  />
                  <Button size="sm" onClick={() => addInfo.mutate()} className="h-8 bg-primary text-primary-foreground hover:bg-primary/90">
                    +
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-foreground">Histórico de ligações</p>
                {detail.historico_ligacoes?.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma ligação ainda</p> : null}
                <div className="space-y-2">
                  {detail.historico_ligacoes?.map((result) => (
                    <div key={result.id} className="space-y-1 rounded-lg border border-border bg-card px-3 py-2">
                      <div className="flex gap-2">
                        <Badge variant="outline" className={interesseBadge(result.interesse)}>
                          {result.interesse}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(result.criado_em).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{result.resumo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
