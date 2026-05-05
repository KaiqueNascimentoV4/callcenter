import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatVariant = "default" | "blue" | "orange" | "green" | "purple";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  variant?: StatVariant;
  accentClassName?: string;
  className?: string;
};

const variantMap: Record<StatVariant, string> = {
  default: "border-border bg-card shadow-[var(--shadow-xs)]",
  blue: "stat-gradient-blue border shadow-[var(--shadow-sm)]",
  orange: "stat-gradient-orange border shadow-[var(--shadow-sm)]",
  green: "stat-gradient-green border shadow-[var(--shadow-sm)]",
  purple: "stat-gradient-purple border shadow-[var(--shadow-sm)]",
};

export function StatCard({ label, value, hint, icon: Icon, variant = "default", accentClassName, className }: StatCardProps) {
  const isGradient = variant !== "default";
  return (
    <Card className={cn(variantMap[variant], "rounded-xl", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em]",
            isGradient ? "text-white/70" : "text-muted-foreground",
          )}>
            {label}
          </p>
          <div className="space-y-1">
            <p className={cn(
              "text-[30px] font-bold leading-none",
              isGradient ? "text-white" : "text-foreground",
            )}>
              {value}
            </p>
            {hint ? (
              <p className={cn("text-xs", isGradient ? "text-white/60" : "text-muted-foreground")}>
                {hint}
              </p>
            ) : null}
          </div>
        </div>
        {Icon ? (
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg border",
            isGradient
              ? "border-white/20 bg-white/15 text-white"
              : "border-border bg-muted/60 text-primary",
            accentClassName,
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
