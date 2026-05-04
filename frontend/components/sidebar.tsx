"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, PhoneCall, Settings, Megaphone, LogOut, Bot, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { adminApi } from "@/lib/api";
import { useState, useEffect } from "react";

const BASE_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/results", label: "Ligações", icon: PhoneCall },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/config", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const users = await adminApi.listUsers();
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) return;
        const me = users.find((u) => u.user_id === user.id);
        setIsAdmin(!!me?.admin);
      } catch {
        // não é admin ou backend indisponível
      }
    }
    void checkAdmin();
  }, []);

  const isLogin = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/pending");
  if (isLogin) return null;

  const links = isAdmin
    ? [...BASE_LINKS, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : BASE_LINKS;

  async function handleSignOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-[#0c0c0c] border-r border-[#1a1a1a] px-3 py-6">
      {/* Logo */}
      <div className="px-3 mb-8 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-[#ff4400] flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-[11px] tracking-wide">V4</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-semibold text-white tracking-tight">Voice Agent</span>
          <span className="text-[10px] text-[#555] tracking-wide uppercase">V4 Company</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {links.map(({ href, label, icon: Icon }, i) => {
          const active = path === href;
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <Link
                href={href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                  active
                    ? "text-white"
                    : "text-[#666] hover:text-[#ccc] hover:bg-[#161616]"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className={cn("w-4 h-4 relative z-10 shrink-0", active && "text-[#ff4400]")} />
                <span className="relative z-10">{label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#555] hover:text-[#ccc] hover:bg-[#161616] transition-all duration-200 disabled:opacity-50"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        <span>{signingOut ? "Saindo..." : "Sair"}</span>
      </button>
    </aside>
  );
}
