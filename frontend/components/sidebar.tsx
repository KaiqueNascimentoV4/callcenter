"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Bot, LayoutDashboard, LogOut, Megaphone, Moon, PanelLeftClose, PanelLeftOpen, PhoneCall, Settings, ShieldCheck, Sun, Users } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agentes", icon: Bot },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/results", label: "Ligações", icon: PhoneCall },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/config", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "true");
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; avatar?: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user: supaUser } } = await getSupabase().auth.getUser();
      if (!supaUser) return;

      setUser({
        name: supaUser.user_metadata?.full_name ?? supaUser.user_metadata?.name ?? supaUser.email?.split("@")[0],
        email: supaUser.email,
        avatar: supaUser.user_metadata?.avatar_url ?? supaUser.user_metadata?.picture,
      });

      try {
        const users = await adminApi.listUsers();
        setIsAdmin(Boolean(users.find((entry) => entry.user_id === supaUser.id)?.admin));
      } catch {
        setIsAdmin(false);
      }
    }

    void load();
  }, []);

  const links = useMemo(
    () => (isAdmin ? [...baseLinks, { href: "/admin", label: "Admin", icon: ShieldCheck }] : baseLinks),
    [isAdmin],
  );

  const hidden = pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/pending");
  if (hidden) return null;

  async function signOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  const initials = user?.name?.split(" ").slice(0, 2).map((chunk) => chunk[0]).join("").toUpperCase() ?? "VC";

  return (
    <motion.aside
      animate={{ width: collapsed ? 84 : 286 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar/95 px-3 py-4 shadow-[var(--shadow-sm)] backdrop-blur lg:flex lg:flex-col"
    >
      <div className={cn("flex flex-col items-center gap-4 rounded-[28px] border border-sidebar-border bg-sidebar-accent/50 px-3 py-4", collapsed ? "px-2" : "px-4")}>
        <div className="flex w-full items-center justify-between">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <Image src="/v4-logo.webp" alt="V4" width={44} height={44} className="h-11 w-11 rounded-2xl object-cover shadow-[var(--shadow-xs)]" />
            {!collapsed ? (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">V4</p>
                <p className="text-lg font-semibold tracking-[0.24em] text-foreground">CALL</p>
              </div>
            ) : null}
          </div>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("sidebar-collapsed", "true");
                setCollapsed(true);
              }}
              className="rounded-xl border border-sidebar-border bg-background/70 p-2 text-muted-foreground transition hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("sidebar-collapsed", "false");
                setCollapsed(false);
              }}
              className="rounded-xl border border-sidebar-border bg-background/70 p-2 text-muted-foreground transition hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>
        {!collapsed ? <p className="text-center text-xs leading-5 text-muted-foreground">Central de operações para agentes, leads, campanhas e resultados com IA.</p> : null}
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                collapsed ? "justify-center" : "",
                active ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]" : "text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border pt-4">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 px-3 py-3 text-sm text-sidebar-foreground/80 transition hover:text-foreground",
            collapsed && "justify-center",
          )}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed ? <span>{resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}</span> : null}
        </button>

        <div className={cn("rounded-[26px] border border-sidebar-border bg-sidebar-accent/50 p-3", collapsed ? "px-2" : "px-3")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-sm font-semibold text-primary">
              {user?.avatar ? <Image src={user.avatar} alt={user.name ?? "Usuário"} width={44} height={44} className="h-full w-full object-cover" unoptimized /> : initials}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "Usuário"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Sem sessão"}</p>
              </div>
            ) : null}
            {!collapsed ? (
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="rounded-xl border border-sidebar-border bg-background/70 p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {collapsed ? (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-sidebar-border bg-background/70 p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.aside>
  );
}
