import type { AdminUserListRow } from "@/lib/admin/adminUsersList";

export type UserAccountStatusKind = "active" | "banned" | "deleted";

const STYLE: Record<UserAccountStatusKind, { label: string; className: string }> = {
  active: { label: "Активен", className: "bg-green-100 text-green-700" },
  banned: { label: "Блокиран", className: "bg-yellow-100 text-yellow-700" },
  deleted: { label: "Изтрит", className: "bg-red-100 text-red-700" },
};

export function deriveUserAccountStatus(row: Pick<AdminUserListRow, "deleted_at" | "banned_active">): UserAccountStatusKind {
  if (row.deleted_at) return "deleted";
  if (row.banned_active) return "banned";
  return "active";
}

export function deriveUserDetailStatus(params: { deletedAt: string | null; banned: boolean }): UserAccountStatusKind {
  if (params.deletedAt) return "deleted";
  if (params.banned) return "banned";
  return "active";
}

type Props = {
  kind: UserAccountStatusKind;
  className?: string;
};

export default function StatusBadge({ kind, className = "" }: Props) {
  const s = STYLE[kind];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight ${s.className} ${className}`.trim()}
    >
      {s.label}
    </span>
  );
}
