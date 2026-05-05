import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border bg-card/90 shadow-[var(--shadow-xs)]">
      <CardContent className="flex flex-col items-start gap-4 p-8 lg:p-10">
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
