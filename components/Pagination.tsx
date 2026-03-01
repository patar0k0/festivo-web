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
              "rounded-full border border-black/[0.1] px-4 py-2 text-sm transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25",
              pageNumber === page ? "border-[#0c0e14] bg-[#0c0e14] text-white hover:bg-[#0c0e14]" : "bg-white/80 text-[#0c0e14]"
            )}
          >
            {pageNumber}
          </Link>
        );
      })}
    </div>
  );
}
