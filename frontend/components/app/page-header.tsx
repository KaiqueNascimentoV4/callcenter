import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 pb-1 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-[30px] font-bold tracking-tight text-foreground lg:text-[34px]">{title}</h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground lg:text-[15px]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div> : null}
    </header>
  );
}
