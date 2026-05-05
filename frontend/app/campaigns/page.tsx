"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, type Campaign } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type CampaignFormKey = "nome" | "descricao" | "objetivo" | "oferta";

const EMPTY: Partial<Campaign> = { nome: "", descricao: "", objetivo: "", oferta: "", ativo: true };
const CAMPAIGN_FIELDS: Array<{ key: CampaignFormKey; label: string; placeholder: string }> = [
  { key: "nome", label: "Nome *", placeholder: "Campanha Outbound Q2" },
  { key: "descricao", label: "Descrição", placeholder: "Descrição da campanha" },
  { key: "objetivo", label: "Objetivo da ligação", placeholder: "Confirmar interesse" },
  { key: "oferta", label: "Produto / oferta", placeholder: "Plano Pro" },
];

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState<Campaign | null>(null);
  const [form, setForm] = useState<Partial<Campaign>>(EMPTY);

  const { data: campaigns, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: campaignsApi.list });

  const save = useMutation({
    mutationFn: (campaign: Partial<Campaign>) => (campaign.id ? campaignsApi.update(campaign.id, campaign) : campaignsApi.create(campaign)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setOpenForm(false);
      toast.success("Campanha salva");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: campaignsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campanha removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dispatch = useMutation({
    mutationFn: (id: string) => campaignsApi.dispatch(id),
    onSuccess: (data) => {
      toast.success(`${data.dispatched} ligações iniciadas`);
      setConfirmDispatch(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirmDispatch(null);
    },
  });

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        eyebrow="Operação / Campanhas"
        title="Campanhas"
        description="Organize objetivos, ofertas e disparos em massa com uma camada mais clara de gestão."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpenForm(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        }
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando campanhas...</p> : null}

      {!isLoading && (!campaigns || campaigns.length === 0) ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha criada"
          description="Monte campanhas com objetivo, oferta e operação de disparo para organizar melhor a cadência comercial."
          actionLabel="Criar campanha"
          onAction={() => {
            setForm(EMPTY);
            setOpenForm(true);
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns?.map((campaign, index) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35 }}
          >
            <Card className="h-full border-border bg-card shadow-[var(--shadow-xs)] transition-colors hover:border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base text-foreground">{campaign.nome}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      campaign.ativo
                        ? "shrink-0 border-green-500/30 bg-green-500/10 text-green-500"
                        : "shrink-0 border-border text-muted-foreground"
                    }
                  >
                    {campaign.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                {campaign.descricao ? <p className="text-sm text-muted-foreground">{campaign.descricao}</p> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {campaign.objetivo ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Objetivo:</span> {campaign.objetivo}
                  </p>
                ) : null}
                {campaign.oferta ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Oferta:</span> {campaign.oferta}
                  </p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                    onClick={() => setConfirmDispatch(campaign)}
                    disabled={!campaign.ativo}
                  >
                    <Zap className="mr-1 h-3.5 w-3.5" />
                    Disparar
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setForm(campaign);
                      setOpenForm(true);
                    }}
                    className="h-8 w-8 border-border"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => remove.mutate(campaign.id)}
                    className="h-8 w-8 border-border text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{form.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {CAMPAIGN_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={form[key] ?? ""}
                  placeholder={placeholder}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  className="mt-1 bg-muted"
                />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={form.ativo ?? true} onCheckedChange={(value) => setForm((prev) => ({ ...prev, ativo: value }))} />
              <Label className="text-sm text-muted-foreground">Campanha ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => save.mutate(form)}
              disabled={save.isPending || !form.nome}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDispatch} onOpenChange={(open) => !open && setConfirmDispatch(null)}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Disparar campanha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso vai iniciar ligações para todos os leads com status <span className="font-medium text-foreground">novo</span> ou{" "}
            <span className="font-medium text-foreground">contactado</span> na campanha{" "}
            <span className="font-medium text-primary">{confirmDispatch?.nome}</span>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDispatch(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => dispatch.mutate(confirmDispatch!.id)}
              disabled={dispatch.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {dispatch.isPending ? "Disparando..." : "Disparar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
