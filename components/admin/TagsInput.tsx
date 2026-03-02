"use client";

import { KeyboardEvent, useState } from "react";

type TagsInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
};

export default function TagsInput({ value, onChange }: TagsInputProps) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const normalized = input.trim();
    if (!normalized) return;
    if (value.includes(normalized)) {
      setInput("");
      return;
    }
    onChange([...value, normalized]);
    setInput("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
  };

  return (
    <div className="rounded-xl border border-black/[0.1] bg-white px-3 py-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="rounded-full border border-black/[0.1] bg-black/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-black/70"
          >
            {tag} ×
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Добави tag"
          className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
        >
          Add
        </button>
      </div>
    </div>
  );
}
