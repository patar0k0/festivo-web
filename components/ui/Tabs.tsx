"use client";

import { cn } from "@/components/ui/cn";

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export default function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("inline-flex gap-1 rounded-xl bg-neutral-100 p-1", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1 text-sm font-semibold transition",
              isActive ? "bg-white text-ink shadow-sm" : "text-neutral-600 hover:text-ink"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
