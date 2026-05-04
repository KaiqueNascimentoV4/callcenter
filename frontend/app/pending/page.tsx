"use client";
import { getSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export default function PendingPage() {
  const router = useRouter();

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#ff4400]/10 border border-[#ff4400]/20 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-[#ff4400]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Aguardando aprovação</h1>
          <p className="text-[#666] text-sm mt-2">
            Sua conta foi criada mas ainda precisa ser aprovada por um administrador.
            Você será notificado assim que o acesso for liberado.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-[#2a2a2a] text-[#888] hover:text-white"
          onClick={() => void handleSignOut()}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}
