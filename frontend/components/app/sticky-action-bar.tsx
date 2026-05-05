import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StickyActionBarProps = {
  message?: ReactNode;
  actions: ReactNode;
  className?: string;
};

export function StickyActionBar({ message, actions, className }: StickyActionBarProps) {
  return (
    <div className={cn("sticky bottom-4 z-20 rounded-2xl border border-border bg-background/90 px-4 py-3 shadow-lg backdrop-blur", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">{message}</div>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>
    </div>
  );
}
