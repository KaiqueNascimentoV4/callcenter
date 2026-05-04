"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type UserApproval } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, UserCog } from "lucide-react";

export default function AdminPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-approvals"],
    queryFn: adminApi.listUsers,
  });

  const patch = useMutation({
    mutationFn: ({ userId, fields }: { userId: string; fields: Partial<Pick<UserApproval, "approved" | "admin">> }) =>
      adminApi.patchUser(userId, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-approvals"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Administração</h1>
        <p className="text-[#666] text-sm mt-1">Aprovação de acesso e permissões de usuários</p>
      </motion.div>

      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[#1e1e1e]">
            <tr>
              {["Email", "Status", "Admin", "Cadastro", "Ações"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-[#555] text-[11px] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-[#555]">Carregando…</td></tr>
            ) : data?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-[#555]">Nenhum usuário</td></tr>
            ) : data?.map((u) => (
              <tr key={u.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616]">
                <td className="px-4 py-3 text-[#ccc]">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={u.approved
                    ? "border-green-500/40 text-green-400"
                    : "border-yellow-500/40 text-yellow-400"}>
                    {u.approved ? "Aprovado" : "Pendente"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={u.admin
                    ? "border-[#ff4400]/40 text-[#ff4400]"
                    : "border-[#2a2a2a] text-[#555]"}>
                    {u.admin ? "Admin" : "—"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[#555] text-[12px]">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {!u.approved ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400 hover:bg-green-500/10"
                        onClick={() => patch.mutate({ userId: u.user_id, fields: { approved: true } })}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Aprovar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                        onClick={() => patch.mutate({ userId: u.user_id, fields: { approved: false } })}>
                        <ShieldX className="w-3.5 h-3.5 mr-1" /> Revogar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost"
                      className={`h-7 text-xs hover:bg-[#2a2a2a] ${u.admin ? "text-[#ff4400]" : "text-[#666]"}`}
                      onClick={() => patch.mutate({ userId: u.user_id, fields: { admin: !u.admin } })}>
                      <UserCog className="w-3.5 h-3.5 mr-1" /> {u.admin ? "Remover admin" : "Tornar admin"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
