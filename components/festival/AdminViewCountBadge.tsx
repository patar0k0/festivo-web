// components/festival/AdminViewCountBadge.tsx
//
// Admin-only inline badge показващ колко пъти даден фестивал е бил гледан.
// Не прави own data fetching — родителят (festival detail page-а) подава
// counts като props. Render-ва се само когато реалният рендер реши.

type Props = {
  last30d: number;
  total: number;
};

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

export default function AdminViewCountBadge({ last30d, total }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-medium text-black/60"
      title={`${total} прегледа общо, ${last30d} за последните 30 дни (без admin/ботове)`}
    >
      <span aria-hidden>👁</span>
      <span>
        {formatCount(last30d)} <span className="text-black/35">/ 30д</span>
        {" · "}
        {formatCount(total)} <span className="text-black/35">всичко</span>
      </span>
    </span>
  );
}
