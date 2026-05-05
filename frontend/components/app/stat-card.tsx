import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accentClassName?: string;
  className?: string;
};

export function StatCard({ label, value, hint, icon: Icon, accentClassName, className }: StatCardProps) {
  return (
    <Card className={cn("border-border bg-card shadow-sm", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <div className="space-y-1">
            <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
        {Icon ? (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary", accentClassName)}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
