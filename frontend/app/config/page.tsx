"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi, type BotConfig } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { FormSection } from "@/components/app/form-section";
import { StickyActionBar } from "@/components/app/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

const MODELS = ["gemini-3.1-flash-live-preview", "gemini-2.5-flash-live-preview", "gemini-2.0-flash-live-001"];
const VOICES = ["Kore", "Aoede", "Charon", "Fenrir", "Puck", "Orbit", "Zephyr", "Leda", "Orus"];

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["bot-config"], queryFn: configApi.get });
  const [draft, setDraft] = useState<Partial<BotConfig> | null>(null);
  const form = draft ?? data ?? {};
  const baseline = JSON.stringify(data ?? {});
  const isDirty = draft !== null && JSON.stringify(form) !== baseline;

  const saveMutation = useMutation({
    mutationFn: () => configApi.update(form),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["bot-config"] });
      setDraft(saved);
      toast.success("Defaults globais atualizados");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return <div className="page-shell"><div className="h-96 animate-pulse rounded-3xl border border-border bg-card" /></div>;
  }

  return (
    <div className="page-shell pb-8">
      <PageHeader
        eyebrow="Operação / Configurações"
        title="Defaults globais"
        description="Esta área fica com o que é realmente sistêmico: defaults de fallback quando o agente não sobrescreve comportamento, voz ou modelo."
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar defaults
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <div className="space-y-6">
          <FormSection title="Identidade padrão" description="Esses valores entram como fallback quando o agente específico não possui override.">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome padrão da empresa</Label>
                <Input value={form.empresa_nome ?? ""} onChange={(e) => setDraft((prev) => ({ ...(prev ?? data ?? {}), empresa_nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Timeout padrão (s)</Label>
                <Input type="number" min={30} max={600} value={form.timeout_segundos ?? 120} onChange={(e) => setDraft((prev) => ({ ...(prev ?? data ?? {}), timeout_segundos: Number(e.target.value) }))} />
              </div>
            </div>
          </FormSection>

          <FormSection title="IA padrão" description="Somente para fallback operacional; o lugar ideal de configuração é a tela do agente.">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Modelo Gemini padrão</Label>
                <Select value={form.modelo_gemini ?? MODELS[0]} onValueChange={(value) => setDraft((prev) => ({ ...(prev ?? data ?? {}), modelo_gemini: value ?? MODELS[0] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voz padrão</Label>
                <Select value={form.voz ?? VOICES[0]} onValueChange={(value) => setDraft((prev) => ({ ...(prev ?? data ?? {}), voz: value ?? VOICES[0] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map((voice) => <SelectItem key={voice} value={voice}>{voice}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Agente fala primeiro por padrão</p>
                    <p className="text-sm text-muted-foreground">O agente específico pode sobrescrever isso na própria configuração.</p>
                  </div>
                  <Switch
                    checked={form.quem_fala_primeiro === "agente"}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...(prev ?? data ?? {}), quem_fala_primeiro: checked ? "agente" : "usuario" }))}
                  />
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        <aside>
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" /> Escopo desta aba</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>Prompt, contexto, VAD, webhooks e voz operacional agora devem ser pensados na tela do agente.</p>
              <p>Use esta aba apenas para defaults de fallback e parâmetros realmente sistêmicos.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <StickyActionBar
        message={isDirty ? "Existem alterações globais pendentes. Elas afetam apenas o que não estiver sobrescrito no agente." : "Defaults globais salvos e prontos para fallback."}
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar defaults
          </Button>
        }
      />
    </div>
  );
}
