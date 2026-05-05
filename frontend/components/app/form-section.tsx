import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
};

export function FormSection({ title, description, aside, children }: FormSectionProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="gap-3 border-b border-border/80 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
            {description ? <CardDescription className="text-sm leading-6 text-muted-foreground">{description}</CardDescription> : null}
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
