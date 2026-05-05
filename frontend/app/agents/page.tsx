"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, RefreshCw, Volume2, Copy, X } from "lucide-react";
import { useRef, useState } from "react";

type KVEntry = { key: string; value: string };

function kvFromObj(obj: Record<string, unknown>): KVEntry[] {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

function kvToObj(entries: KVEntry[]): Record<string, unknown> {
  return Object.fromEntries(
    entries.filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value])
  );
}

const EMPTY: Partial<Agent> = {
  nome: "",
  ativo: true,
  empresa_nome: "",
  prompt_template: "",
  instrucoes_background: "",
  modelo_gemini: "gemini-2.0-flash-live-001",
  voz: "Kore",
  timeout_segundos: 120,
  quem_fala_primeiro: "agente",
  webhook_saida_url: "",
  telefone_json_path: "",
  empresa_contexto: {},
  // Comportamento avançado
  vad_silencio_ms: 800,
  vad_sensibilidade_inicio: "START_SENSITIVITY_LOW",
  vad_sensibilidade_fim: "END_SENSITIVITY_LOW",
  interrupcao_habilitada: true,
  primeiro_turno_delay_ms: 500,
  silencio_encerrar_seg: 0,
  deteccao_voicemail: false,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function AgentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(EMPTY);
  const [kvEntries, setKvEntries] = useState<KVEntry[]>([]);
  const [newKv, setNewKv] = useState({ key: "", value: "" });
  const [playingPreview, setPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents", "all"],
    queryFn: () => agentsApi.list(true),
  });

  const save = useMutation({
    mutationFn: async (a: Partial<Agent>) => {
      const empresa_contexto = kvToObj(kvEntries);
      const payload = {
        ...a,
        empresa_contexto,
        webhook_saida_url: a.webhook_saida_url || null,
        telefone_json_path: a.telefone_json_path || null,
      };
      if (a.id) return agentsApi.update(a.id, payload);
      return agentsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setOpen(false);
      toast.success("Agente salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: agentsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agente desativado");
    },
  });

  const regen = useMutation({
    mutationFn: agentsApi.regenerateToken,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Novo token gerado");
    },
  });

  async function playPreview() {
    if (!form.id) return;
    try {
      setPlayingPreview(true);
      const url = agentsApi.voicePreviewUrl(form.id);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = `${url}?t=${Date.now()}`;
      audioRef.current.onended = () => setPlayingPreview(false);
      await audioRef.current.play().catch(() => {
        toast.error("Não foi possível reproduzir (preview pode estar indisponível no servidor)");
        setPlayingPreview(false);
      });
    } catch {
      toast.error("Erro ao carregar preview");
      setPlayingPreview(false);
    }
  }

  function startCreate() {
    setForm(EMPTY);
    setKvEntries([]);
    setNewKv({ key: "", value: "" });
    setOpen(true);
  }

  function startEdit(a: Agent) {
    setForm(a);
    setKvEntries(kvFromObj(a.empresa_contexto ?? {}));
    setNewKv({ key: "", value: "" });
    setOpen(true);
  }

  function addKv() {
    if (!newKv.key.trim()) return;
    setKvEntries((e) => [...e, { ...newKv }]);
    setNewKv({ key: "", value: "" });
  }

  function removeKv(i: number) {
    setKvEntries((e) => e.filter((_, idx) => idx !== i));
  }

  function copyWebhookUrl(token: string) {
    const full = `${API_BASE}/hooks/inbound/${token}`;
    void navigator.clipboard.writeText(full);
    toast.success("URL do webhook copiada!");
  }

  const inboundPath = form.webhook_entrada_token
    ? `${API_BASE}/hooks/inbound/${form.webhook_entrada_token}`
    : "";

  const inboundExample = form.webhook_entrada_token
    ? `POST ${inboundPath}\nContent-Type: application/json\n{ "nome": "Maria", "telefone": "+5511999999999" }`
    : "";

  return (
    <div className="space-y-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Persona, script, voz, webhooks e URL de disparo por agente</p>
        </div>
        <Button onClick={startCreate} className="bg-primary hover:bg-primary/90 text-foreground border-0">
          <Plus className="w-4 h-4 mr-1.5" /> Novo agente
        </Button>
      </motion.div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              {["Nome", "Empresa", "Voz", "Modelo", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : agents?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum agente — crie o primeiro para associar a leads
                </td>
              </tr>
            ) : (
              agents?.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-4 py-3 font-medium text-foreground">{a.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.empresa_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.voz}</td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">{a.modelo_gemini}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={a.ativo ? "border-green-500/40 text-green-400" : "border-muted-foreground text-muted-foreground"}>
                      {a.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => startEdit(a)}>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => remove.mutate(a.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form.id ? "Editar agente" : "Novo agente"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Ativo</Label>
              <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Nome do agente *</Label>
                <Input
                  className="bg-muted border-border text-foreground"
                  value={form.nome ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="João — SDR"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nome fantasia / empresa</Label>
                <Input
                  className="bg-muted border-border text-foreground"
                  value={form.empresa_nome ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, empresa_nome: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Modelo Gemini</Label>
                <select
                  className="w-full h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                  value={form.modelo_gemini ?? "gemini-2.0-flash-live-001"}
                  onChange={(e) => setForm((f) => ({ ...f, modelo_gemini: e.target.value }))}
                >
                  <option value="gemini-2.0-flash-live-001">gemini-2.0-flash-live-001</option>
                  <option value="gemini-2.5-flash-live-preview">gemini-2.5-flash-live-preview</option>
                  <option value="gemini-3.1-flash-live-preview">gemini-3.1-flash-live-preview</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Voz (prebuilt)</Label>
                <select
                  className="w-full h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                  value={form.voz ?? "Kore"}
                  onChange={(e) => setForm((f) => ({ ...f, voz: e.target.value }))}
                >
                  {["Kore", "Aoede", "Charon", "Fenrir", "Puck", "Orbit", "Zephyr", "Leda", "Orus", "Autonoe"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Timeout (s)</Label>
                <Input
                  type="number"
                  className="bg-muted border-border text-foreground"
                  value={form.timeout_segundos ?? 120}
                  onChange={(e) => setForm((f) => ({ ...f, timeout_segundos: +e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Quem fala primeiro</Label>
                <select
                  className="w-full h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                  value={form.quem_fala_primeiro ?? "agente"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quem_fala_primeiro: e.target.value as "agente" | "usuario" }))
                  }
                >
                  <option value="agente">Agente</option>
                  <option value="usuario">Cliente (aguardar)</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Template do prompt (placeholders {'{{nome}}'}, {'{{empresa}}'}, …)</Label>
              <Textarea
                className="bg-muted border-border text-foreground min-h-[100px] font-mono text-xs"
                value={form.prompt_template ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, prompt_template: e.target.value }))}
                placeholder="Deixe vazio para usar o texto padrão do sistema"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Instruções de background</Label>
              <Textarea
                className="bg-muted border-border text-foreground min-h-[72px]"
                value={form.instrucoes_background ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, instrucoes_background: e.target.value }))}
              />
            </div>

            {/* Contexto empresa como key-value */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Contexto da empresa</p>
              {kvEntries.map((entry, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="bg-muted border-border text-foreground text-xs h-8 flex-1"
                    value={entry.key}
                    onChange={(e) => setKvEntries((es) => es.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                    placeholder="chave"
                  />
                  <Input
                    className="bg-muted border-border text-foreground text-xs h-8 flex-[2]"
                    value={entry.value}
                    onChange={(e) => setKvEntries((es) => es.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                    placeholder="valor"
                  />
                  <Button type="button" size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => removeKv(i)}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <Input
                  className="bg-muted border-border text-foreground text-xs h-8 flex-1"
                  value={newKv.key}
                  onChange={(e) => setNewKv((n) => ({ ...n, key: e.target.value }))}
                  placeholder="nova chave"
                  onKeyDown={(e) => e.key === "Enter" && addKv()}
                />
                <Input
                  className="bg-muted border-border text-foreground text-xs h-8 flex-[2]"
                  value={newKv.value}
                  onChange={(e) => setNewKv((n) => ({ ...n, value: e.target.value }))}
                  placeholder="valor"
                  onKeyDown={(e) => e.key === "Enter" && addKv()}
                />
                <Button type="button" size="sm" variant="outline" className="h-8 border-border text-muted-foreground" onClick={addKv}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Comportamento avançado da ligação */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Comportamento da Ligação</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Silêncio VAD (ms)</Label>
                  <Input
                    type="number"
                    min={200} max={2000} step={100}
                    className="bg-muted border-border text-foreground"
                    value={form.vad_silencio_ms ?? 800}
                    onChange={(e) => setForm((f) => ({ ...f, vad_silencio_ms: +e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Silêncio mínimo para cortar fala (200–2000)</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Delay primeiro turno (ms)</Label>
                  <Input
                    type="number"
                    min={0} max={5000} step={100}
                    className="bg-muted border-border text-foreground"
                    value={form.primeiro_turno_delay_ms ?? 500}
                    onChange={(e) => setForm((f) => ({ ...f, primeiro_turno_delay_ms: +e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Espera antes do agente falar pela 1ª vez</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sensibilidade início de fala</Label>
                  <select
                    className="w-full h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                    value={form.vad_sensibilidade_inicio ?? "START_SENSITIVITY_LOW"}
                    onChange={(e) => setForm((f) => ({ ...f, vad_sensibilidade_inicio: e.target.value }))}
                  >
                    <option value="START_SENSITIVITY_LOW">Baixa (menos falsos positivos)</option>
                    <option value="START_SENSITIVITY_MEDIUM">Média</option>
                    <option value="START_SENSITIVITY_HIGH">Alta (detecta rápido)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sensibilidade fim de fala</Label>
                  <select
                    className="w-full h-9 rounded-md bg-muted border border-border text-foreground px-2 text-sm"
                    value={form.vad_sensibilidade_fim ?? "END_SENSITIVITY_LOW"}
                    onChange={(e) => setForm((f) => ({ ...f, vad_sensibilidade_fim: e.target.value }))}
                  >
                    <option value="END_SENSITIVITY_LOW">Baixa (aguarda mais antes de cortar)</option>
                    <option value="END_SENSITIVITY_MEDIUM">Média</option>
                    <option value="END_SENSITIVITY_HIGH">Alta (corta rápido)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Encerrar após silêncio (s)</Label>
                  <Input
                    type="number"
                    min={0} max={300} step={5}
                    className="bg-muted border-border text-foreground"
                    value={form.silencio_encerrar_seg ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, silencio_encerrar_seg: +e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">0 = desabilitado</p>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Interrupção habilitada (barge-in)</Label>
                    <Switch
                      checked={form.interrupcao_habilitada ?? true}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, interrupcao_habilitada: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Detectar voicemail (AMD)</Label>
                    <Switch
                      checked={form.deteccao_voicemail ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, deteccao_voicemail: v }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Webhooks</p>
              <div>
                <Label className="text-xs text-muted-foreground">URL saída (POST após resultado da ligação)</Label>
                <Input
                  className="bg-muted border-border text-foreground"
                  value={form.webhook_saida_url ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, webhook_saida_url: e.target.value || undefined }))}
                  placeholder="https://..."
                />
              </div>
              {form.id && form.webhook_entrada_token && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Disparo entrada (POST JSON → cria lead e liga)</Label>
                    <pre className="text-[10px] bg-background p-2 rounded border border-border text-foreground whitespace-pre-wrap break-all mt-1">
                      {inboundExample}
                    </pre>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 border-border text-muted-foreground gap-1.5"
                      onClick={() => copyWebhookUrl(form.webhook_entrada_token!)}
                    >
                      <Copy className="w-3 h-3" /> Copiar URL do webhook
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">JSONPath do telefone (opcional)</Label>
                    <Input
                      className="bg-muted border-border text-foreground flex-1"
                      value={form.telefone_json_path ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, telefone_json_path: e.target.value || undefined }))}
                      placeholder="$.telefone"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-border"
                      onClick={() => form.id && regen.mutate(form.id)}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Novo token
                    </Button>
                  </div>
                </>
              )}
            </div>

            {form.id && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-foreground gap-2"
                  onClick={() => void playPreview()}
                  disabled={playingPreview}
                >
                  <Volume2 className={`w-4 h-4 ${playingPreview ? "text-primary animate-pulse" : ""}`} />
                  {playingPreview ? "Reproduzindo…" : "Ouvir amostra da voz"}
                </Button>
                <span className="text-[11px] text-muted-foreground">Usa Gemini TTS; pode falhar conforme região.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-border text-muted-foreground" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-foreground border-0" onClick={() => save.mutate(form)} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
