"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, PhoneCall, Settings, Megaphone, LogOut,
  Bot, ShieldCheck, PanelLeftClose, PanelLeftOpen, Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { adminApi } from "@/lib/api";
import { useTheme } from "next-themes";
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
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored) setCollapsed(stored === "true");
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  }

  useEffect(() => {
    async function loadUser() {
      const { data: { user: u } } = await getSupabase().auth.getUser();
      if (!u) return;
      const meta = u.user_metadata;
      setUser({
        email: u.email,
        name: meta?.full_name ?? meta?.name ?? u.email?.split("@")[0],
        avatar: meta?.avatar_url ?? meta?.picture,
      });
      try {
        const users = await adminApi.listUsers();
        const me = users.find((x) => x.user_id === u.id);
        setIsAdmin(!!me?.admin);
      } catch { /* não é admin */ }
    }
    void loadUser();
  }, []);

  const isHidden = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/pending");
  if (isHidden) return null;

  const links = isAdmin
    ? [...BASE_LINKS, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : BASE_LINKS;

  async function handleSignOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
      className="shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border px-2 py-4 overflow-hidden"
    >
      {/* Header: logo + collapse button */}
      <div className="flex items-center justify-between px-2 mb-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/v4-logo.webp" alt="V4" className="w-7 h-7 shrink-0 rounded" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-foreground font-bold text-sm tracking-[0.2em] uppercase overflow-hidden whitespace-nowrap"
              >
                CALL
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={toggleCollapse}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
        </button>
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
                title={collapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                  collapsed ? "justify-center" : "",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent border border-sidebar-border"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className={cn("w-4 h-4 relative z-10 shrink-0", active && "text-primary")} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative z-10 overflow-hidden whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200",
          collapsed ? "justify-center" : ""
        )}
      >
        {resolvedTheme === "dark"
          ? <Sun className="w-4 h-4 shrink-0" />
          : <Moon className="w-4 h-4 shrink-0" />}
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              {resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* User profile */}
      <div className={cn(
        "mt-2 border-t border-sidebar-border pt-3 flex items-center gap-2.5 px-2",
        collapsed ? "justify-center" : ""
      )}>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-primary/20 flex items-center justify-center">
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            : <span className="text-[11px] font-semibold text-primary">{initials}</span>}
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 min-w-0 overflow-hidden"
            >
              <p className="text-[12px] font-medium text-foreground truncate">{user?.name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!collapsed && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sair"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {collapsed && (
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sair"
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.aside>
  );
}
