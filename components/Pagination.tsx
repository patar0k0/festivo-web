import Link from "next/link";
import { Filters } from "@/lib/types";
import { serializeFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

export default function Pagination({
  page,
  totalPages,
  basePath,
  filters,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  filters: Filters;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }).slice(0, 5);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pages.map((_, index) => {
        const pageNumber = index + 1;
        const query = serializeFilters({ ...filters, month: filters.month });
        const suffix = query ? `${query}&page=${pageNumber}` : `?page=${pageNumber}`;
        return (
          <Link
            key={pageNumber}
            href={`${basePath}${suffix}`}
            className={cn(
              "rounded-full border border-ink/10 px-4 py-2 text-sm",
              pageNumber === page ? "bg-ink text-white" : "bg-white"
            )}
          >
            {pageNumber}
          </Link>
        );
      })}
    </div>
  );
}
