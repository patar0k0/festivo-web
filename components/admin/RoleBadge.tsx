import type { AppRole } from "@/lib/admin/appRoles";
import { appRoleLabelBg } from "@/lib/admin/appRoles";

type Props = {
  role: AppRole;
  className?: string;
};

export default function RoleBadge({ role, className = "" }: Props) {
  const label = role === "super_admin" ? "SUPER ADMIN" : role === "admin" ? "ADMIN" : appRoleLabelBg(role).toUpperCase();

  if (role === "super_admin") {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-purple-400 bg-purple-200 px-2 py-0.5 text-[11px] font-bold tracking-tight text-purple-900 ${className}`.trim()}
      >
        {label}
      </span>
    );
  }

  if (role === "admin") {
    return (
      <span
        className={`inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold tracking-tight text-purple-700 ${className}`.trim()}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight bg-gray-100 text-gray-700 ${className}`.trim()}
    >
      {label}
    </span>
  );
}
