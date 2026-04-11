"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

type HomeDiscoverySearchClientProps = {
  secondaryActions: ReactNode;
  /** Tighter layout for the fixed mobile dock */
  compact?: boolean;
};

const PLACEHOLDER = "🔍 Търси фестивал, град или събитие...";

export default function HomeDiscoverySearchClient({
  secondaryActions,
  compact,
}: HomeDiscoverySearchClientProps) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (!q) {
      router.push("/festivals");
      return;
    }
    router.push(`/festivals?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <form
        className="relative w-full"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="search"
          name="home-discovery-q"
          enterKeyHint="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER}
          aria-label={PLACEHOLDER}
          className={cn(
            pub.inputSearch,
            compact
              ? "rounded-full py-2.5 pl-4 pr-12 text-sm"
              : "rounded-full py-3 pl-5 pr-14 text-[15px] md:py-3.5 md:pl-6 md:pr-14 md:text-[15px]",
          )}
        />
        <button
          type="submit"
          aria-label="Търси"
          className={cn(
            "absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full text-[#0c0e14] transition hover:bg-black/[0.05]",
            pub.focusRing,
            compact ? "right-1.5 h-9 w-9" : "right-2 h-9 w-9 md:h-10 md:w-10"
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-black/45"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
      </form>
      <div className={cn("flex flex-wrap gap-2", !compact && "sm:gap-3")}>{secondaryActions}</div>
    </div>
  );
}
