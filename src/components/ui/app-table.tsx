import type { ComponentProps } from "react";
import { cn } from "@/utils/utils";

export function AppTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="w-full overflow-x-auto rounded-lg border border-border/50"
    >
      <table data-slot="table" className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function AppTableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-border/50 [&_tr]:bg-muted/30 [&_tr]:hover:bg-muted/30",
        className
      )}
      {...props}
    />
  );
}

export function AppTableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/30 transition-colors even:bg-muted/10 hover:bg-muted/40 data-[state=selected]:bg-primary/10",
        className
      )}
      {...props}
    />
  );
}

export function AppTableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn("px-4 py-3 text-left font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function AppTableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-4 py-3", className)} {...props} />;
}
