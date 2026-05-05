"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  Bot,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; links: NavLink[] };

const baseGroups: NavGroup[] = [
  {
    label: "PRINCIPAL",
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
    ],
  },
  {
    label: "OPERAÇÃO",
    links: [
      { href: "/agents", label: "Agentes", icon: Bot },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/results", label: "Ligações", icon: PhoneCall },
    ],
  },
  {
    label: "SISTEMA",
    links: [
      { href: "/config", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "true",
  );
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; avatar?: string } | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user: supaUser },
      } = await getSupabase().auth.getUser();
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

  const allGroups = useMemo<NavGroup[]>(() => {
    if (!isAdmin) return baseGroups;
    return [
      ...baseGroups,
      { label: "ADMIN", links: [{ href: "/admin", label: "Admin", icon: ShieldCheck }] },
    ];
  }, [isAdmin]);

  const hidden = pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/pending");
  if (hidden) return null;

  async function signOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  const initials =
    user?.name
      ?.split(" ")
      .slice(0, 2)
      .map((chunk) => chunk[0])
      .join("")
      .toUpperCase() ?? "VC";

  return (
    <motion.aside
      animate={{ width: collapsed ? 84 : 278 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar/96 px-3 py-4 shadow-[var(--shadow-sm)] backdrop-blur lg:flex lg:flex-col"
    >
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3 py-3",
          collapsed ? "px-2.5" : "px-3",
        )}
      >
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-background/70 shadow-[var(--shadow-xs)]">
            <Image src="/v4-brand-symbol.png" alt="V4" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
          </div>
          {!collapsed ? (
            <div className="flex flex-col justify-center leading-none">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">V4</p>
              <p className="mt-1 text-[22px] font-semibold tracking-[0.24em] text-foreground">CALL</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          onClick={() => {
            const next = !collapsed;
            localStorage.setItem("sidebar-collapsed", String(next));
            setCollapsed(next);
          }}
          className="rounded-lg border border-sidebar-border bg-background/60 p-2 text-muted-foreground transition hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto">
        {allGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {!collapsed ? (
              <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground/55">
                {group.label}
              </p>
            ) : (
              <div className="mx-auto mb-1 h-px w-6 bg-sidebar-border" />
            )}
            {group.links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    collapsed ? "justify-center" : "",
                    active
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(234,59,23,0.35)]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed ? <span>{label}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border pt-4">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-sm text-sidebar-foreground/80 transition hover:text-foreground",
            collapsed && "justify-center",
          )}
        >
          {resolvedTheme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {!collapsed ? <span>{resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}</span> : null}
        </button>

        <div
          className={cn(
            "rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3",
            collapsed ? "px-2.5" : "px-3",
          )}
        >
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-primary/12 text-sm font-semibold text-primary">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name ?? "Usuário"}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                initials
              )}
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
                className="rounded-lg border border-sidebar-border bg-background/60 p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
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
              className="mt-3 flex w-full items-center justify-center rounded-lg border border-sidebar-border bg-background/60 p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.aside>
  );
}
