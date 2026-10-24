import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

interface SortableTableHeaderProps {
  children: ReactNode;
  ascending?: boolean;
  onSort: () => void;
  className?: string;
}

export function SortableTableHeader({
  children,
  ascending,
  onSort,
  className,
}: SortableTableHeaderProps) {
  const Icon = ascending === undefined ? ArrowUpDown : ascending ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={ascending === undefined ? "none" : ascending ? "ascending" : "descending"}
      className={className}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        {children}
        <Icon
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 ${ascending === undefined ? "opacity-40" : ""}`}
        />
      </button>
    </th>
  );
}
