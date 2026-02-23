import Button from "@/components/ui/Button";

export default function FilterSidebar() {
  return (
    <aside className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Keyword</p>
        <input
          placeholder="Search events"
          className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Category</p>
        <select className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-orange-500/20">
          <option>All categories</option>
          <option>Music</option>
          <option>Food</option>
          <option>Art</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Location</p>
        <select className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-orange-500/20">
          <option>All locations</option>
          <option>Sofia</option>
          <option>Plovdiv</option>
          <option>Varna</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Date</p>
        <div className="grid gap-2">
          {["This weekend", "This week", "Next week", "This month"].map((label) => (
            <button
              key={label}
              type="button"
              className="h-9 rounded-lg border border-neutral-200 text-sm text-neutral-700 transition hover:border-orange-500 hover:text-orange-500"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Free events only</p>
        <Button variant="secondary" size="sm">
          Toggle free
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">Price range</p>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>From</span>
          <input className="h-9 w-20 rounded-lg border border-neutral-200 px-2 text-sm" placeholder="0" />
          <span>To</span>
          <input className="h-9 w-20 rounded-lg border border-neutral-200 px-2 text-sm" placeholder="100" />
        </div>
      </div>
    </aside>
  );
}
