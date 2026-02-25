import type { Dispatch, SetStateAction } from "react";

const chipClass =
  "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-black/60 shadow-[0_6px_18px_rgba(12,18,32,0.05)]";

const buttonClass =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[14px] border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold shadow-[0_6px_18px_rgba(12,18,32,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-white/90";

const tags = [
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

export default function SearchCard({ query, setQuery, activeTag, setActiveTag, shownCount, onReset }: Props) {
  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/70 shadow-[0_18px_50px_rgba(12,18,32,0.1)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-black/10 bg-white/55 p-3.5">
          <div className="flex w-full max-w-[600px] items-center gap-2.5 rounded-[16px] border border-black/10 bg-white/90 px-3 py-2.5 shadow-[0_8px_18px_rgba(12,18,32,0.06)] max-[560px]:max-w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Търси: София, фолклор, парк, вечер..."
              className="w-full border-0 bg-transparent text-sm text-black outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={chipClass}>Показани: {shownCount}</span>
            <button type="button" className={buttonClass} onClick={onReset}>
              Нулирай
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5">
          <div className="flex flex-wrap gap-2" aria-label="Бързи филтри">
            {tags.map((tag) => {
              const active = activeTag === tag.key;
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => setActiveTag(active ? "" : tag.key)}
                  className={`${chipClass} ${
                    active ? "border-violet-500/40 text-black" : "hover:border-black/20"
                  } transition`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-black/60">Фокусът е: избери 2-3 → отдолу се появява готов план.</div>
        </div>
      </div>
    </div>
  );
}

export { tags as quickTags };
