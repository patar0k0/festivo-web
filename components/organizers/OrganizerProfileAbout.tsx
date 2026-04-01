"use client";

import { useId, useMemo, useState } from "react";

type Props = {
  text: string;
};

/** Heuristic: long copy or many paragraphs benefit from read-more. */
function shouldOfferExpand(text: string): boolean {
  if (text.length > 420) return true;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length > 3) return true;
  return text.split("\n").length > 8;
}

export default function OrganizerProfileAbout({ text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();
  const needsExpand = useMemo(() => shouldOfferExpand(text), [text]);

  return (
    <div className="border-t border-slate-100 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        За организатора
      </h2>
      <div
        id={regionId}
        className={
          !expanded && needsExpand
            ? "relative mt-4 max-h-[11rem] overflow-hidden md:max-h-[12.5rem]"
            : "relative mt-4"
        }
      >
        <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-[1.7] text-slate-600 md:text-base md:leading-relaxed">
          {text}
        </p>
        {!expanded && needsExpand ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/90 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>
      {needsExpand ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-500"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Покажи по-малко" : "Покажи повече"}
        </button>
      ) : null}
    </div>
  );
}
