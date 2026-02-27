import type { Dispatch, SetStateAction } from "react";

export const quickTags = [
  { key: "weekend", label: "уикенд" },
  { key: "today", label: "днес" },
  { key: "evening", label: "вечер" },
  { key: "family", label: "семейни" },
  { key: "outdoor", label: "навън" },
  { key: "chill", label: "chill" },
  { key: "party", label: "party" },
  { key: "culture", label: "culture" },
];

type Props = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  activeTag: string;
  setActiveTag: Dispatch<SetStateAction<string>>;
  shownCount: number;
  onReset: () => void;
};

export default function SearchCard({
  query,
  setQuery,
  activeTag,
  setActiveTag,
  shownCount,
  onReset,
}: Props) {
  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_2px_0_rgba(12,14,20,0.06),0_12px_32px_rgba(12,14,20,0.07)]">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-black/[0.07] px-4 py-3">
          <div className="flex w-full max-w-[600px] items-center gap-2.5 rounded-[14px] border border-black/[0.08] bg-[#f5f4f0] px-3.5 py-2.5 max-[560px]:max-w-full">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 text-black/30"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси: София, фолклор, парк, вечер..."
              className="w-full border-0 bg-transparent text-sm text-[#0c0e14] outline-none placeholder:text-black/30"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[12px] font-bold text-black/40">Показани: {shownCount}</span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-[34px] items-center rounded-[12px] border border-black/[0.1] bg-transparent px-3.5 text-[12px] font-bold transition hover:bg-[#f5f4f0] hover:border-black/20"
            >
              Нулирай
            </button>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" aria-label="Бързи филтри">
          {quickTags.map((tag) => {
            const active = activeTag === tag.key;
            return (
              <button
                key={tag.key}
                type="button"
                onClick={() => setActiveTag(active ? "" : tag.key)}
                className={`inline-flex h-[30px] items-center rounded-full border px-3 text-[12px] font-bold transition ${
                  active
                    ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                    : "border-black/[0.1] bg-transparent text-black/50 hover:border-black/20 hover:text-black/70"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
