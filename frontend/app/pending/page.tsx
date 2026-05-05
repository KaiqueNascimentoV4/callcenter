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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm px-4">
        <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Aguardando aprovação</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Sua conta foi criada mas ainda precisa ser aprovada por um administrador.
            Você será notificado assim que o acesso for liberado.
          </p>
        </div>
        <Button
          variant="outline"
          className="text-muted-foreground"
          onClick={() => void handleSignOut()}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}
